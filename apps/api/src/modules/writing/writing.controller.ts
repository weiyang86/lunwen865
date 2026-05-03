import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { WRITING_HEARTBEAT_INTERVAL_MS } from './constants/writing.constants';
import { WRITING_SSE_EVENTS } from './constants/sse-event.constants';
import type { RetrySectionDto } from './dto/retry-section.dto';
import type { StartWritingDto } from './dto/start-writing.dto';
import type { UpdateSectionDto } from './dto/update-section.dto';
import type { WritingSseEvent } from './interfaces/sse-event.interface';
import { formatSseEvent } from '../opening-report/utils/sse-formatter.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaskService } from '../task/task.service';
import { WritingService } from './services/writing.service';

@Controller('tasks/:taskId/writing')
export class WritingController {
  constructor(
    private readonly writingService: WritingService,
    private readonly taskService: TaskService,
  ) {}

  @Post('start')
  @ApiOperation({ summary: '启动正文生成（SSE）' })
  async start(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: StartWritingDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.writeSse(res, this.writingService.generateStream(taskId, dto));
  }

  @Post('sessions/:sessionId/resume')
  @ApiOperation({ summary: '续传/继续生成（SSE）' })
  async resume(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('sessionId') sessionId: string,
    @Query('fromOrderIndex') fromOrderIndexRaw: string | undefined,
    @Body() dto: StartWritingDto,
    @Res() res: Response,
  ): Promise<void> {
    const fromOrderIndex = fromOrderIndexRaw ? Number(fromOrderIndexRaw) : 0;
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.writeSse(
      res,
      this.writingService.resumeStream(taskId, sessionId, dto, fromOrderIndex),
    );
  }

  @Post('sessions/:sessionId/regenerate-from')
  @ApiOperation({ summary: '从指定位置起重新生成（SSE，会清空后续小节）' })
  async regenerateFrom(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('sessionId') sessionId: string,
    @Query('fromOrderIndex') fromOrderIndexRaw: string,
    @Body() dto: StartWritingDto,
    @Res() res: Response,
  ): Promise<void> {
    const fromOrderIndex = Number(fromOrderIndexRaw);
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.writeSse(
      res,
      this.writingService.regenerateFromStream(
        taskId,
        sessionId,
        dto,
        fromOrderIndex,
      ),
    );
  }

  @Post('sessions/:sessionId/sections/:sectionId/retry')
  @ApiOperation({ summary: '重试单小节（SSE）' })
  async retrySection(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('sessionId') sessionId: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: RetrySectionDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.writeSse(
      res,
      this.writingService.retrySectionStream(taskId, sessionId, sectionId, dto),
    );
  }

  @Post('cancel/:sessionId')
  @ApiOperation({ summary: '请求取消（软取消，仅影响当前流）' })
  async cancel(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('sessionId') sessionId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    this.writingService.requestCancel(sessionId);
    return { success: true };
  }

  @Get('sessions')
  @ApiOperation({ summary: '查询写作会话列表' })
  async listSessions(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.writingService.listSessions(taskId);
  }

  @Get('sessions/latest')
  @ApiOperation({ summary: '查询最新写作会话' })
  async latest(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.writingService.getLatestSession(taskId);
  }

  @Get('sessions/:sessionId/sections')
  @ApiOperation({ summary: '查询会话内全部小节' })
  async listSections(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('sessionId') sessionId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.writingService.listSections(sessionId);
  }

  @Post('sections/:sectionId')
  @ApiOperation({ summary: '人工编辑单小节（覆盖 editedContent）' })
  async updateSection(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.writingService.updateSection(sectionId, dto);
  }

  @Get('document')
  @ApiOperation({ summary: '导出全文（resolved refs）' })
  async exportDocument(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Query('sessionId') sessionId?: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.writingService.exportFullDocument({ taskId, sessionId });
  }

  private async writeSse(
    res: Response,
    stream: AsyncIterable<WritingSseEvent>,
  ) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const heartbeat = setInterval(() => {
      res.write(
        formatSseEvent(WRITING_SSE_EVENTS.HEARTBEAT, { ts: Date.now() }),
      );
    }, WRITING_HEARTBEAT_INTERVAL_MS);

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
        formatSseEvent(WRITING_SSE_EVENTS.SESSION_ERROR, {
          error: message,
          recoverable: true,
        }),
      );
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  }
}
