import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaskService } from '../task/task.service';
import { ResumeGenerationDto } from './dto/resume-generation.dto';
import { RetrySectionDto } from './dto/retry-section.dto';
import { StartGenerationDto } from './dto/start-generation.dto';
import type { SseEvent } from './interfaces/sse-event.interface';
import { OpeningReportService } from './opening-report.service';
import { formatSseEvent } from './utils/sse-formatter.util';

@Controller('tasks/:taskId/opening-report')
export class OpeningReportController {
  constructor(
    private readonly openingReportService: OpeningReportService,
    private readonly taskService: TaskService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: '生成开题报告（SSE 流式）' })
  async generate(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: StartGenerationDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.writeSse(
      res,
      this.openingReportService.generateStream(taskId, dto),
    );
  }

  @Post('resume')
  @ApiOperation({ summary: '续传生成（SSE 流式）' })
  async resume(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: ResumeGenerationDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.writeSse(
      res,
      this.openingReportService.resumeStream(taskId, dto),
    );
  }

  @Post('sections/:sectionKey/retry')
  @ApiOperation({ summary: '重试单章节（SSE 流式）' })
  async retrySection(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('sectionKey') sectionKey: string,
    @Body() dto: RetrySectionDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.writeSse(
      res,
      this.openingReportService.retrySection(taskId, sectionKey, dto),
    );
  }

  @Post('generate-sync')
  @ApiOperation({ summary: '生成开题报告（同步调试用，返回 JSON）' })
  async generateSync(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: StartGenerationDto,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.openingReportService.generateSync(taskId, dto);
  }

  @Get()
  @ApiOperation({ summary: '查询开题报告（含章节）' })
  async findByTaskId(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.openingReportService.findByTaskId(taskId);
  }

  @Get('sections/:sectionKey')
  @ApiOperation({ summary: '查询单章节' })
  async findSection(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('sectionKey') sectionKey: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.openingReportService.findSection(taskId, sectionKey);
  }

  @Delete()
  @ApiOperation({ summary: '删除开题报告（含章节）' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.openingReportService.deleteReport(taskId);
    return { success: true };
  }

  private async writeSse(res: Response, stream: AsyncIterable<SseEvent>) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const heartbeat = setInterval(() => {
      res.write(formatSseEvent('heartbeat', { ts: Date.now() }));
    }, 15000);

    const onClose = () => {
      clearInterval(heartbeat);
      try {
        res.end();
      } catch {
        void 0;
      }
    };

    res.on('close', onClose);

    try {
      for await (const evt of stream) {
        res.write(formatSseEvent(evt.event, evt.data));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(
        formatSseEvent('error', {
          code: 'STREAM_ERROR',
          message,
          recoverable: true,
        }),
      );
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  }
}
