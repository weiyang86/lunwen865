import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaskService } from '../task/task.service';
import { CreateReferenceDto } from './dto/create-reference.dto';
import { GenerateReferenceDto } from './dto/generate-reference.dto';
import { UpdateReferenceDto } from './dto/update-reference.dto';
import { ReferenceService } from './reference.service';

@Controller('tasks/:taskId/references')
export class ReferenceController {
  constructor(
    private readonly referenceService: ReferenceService,
    private readonly taskService: TaskService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: '根据正文 AI 生成参考文献列表' })
  async generate(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: GenerateReferenceDto,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.referenceService.generateFromContent(
      taskId,
      dto.count,
      dto.recentYears,
    );
  }

  @Get()
  @ApiOperation({ summary: '列出所有文献（按 index 排序）' })
  async list(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.referenceService.list(taskId);
  }

  @Get('formatted')
  @ApiOperation({ summary: '输出格式化字符串列表（style=gbt7714）' })
  async formatted(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Query('style') style?: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.referenceService.listFormatted(taskId, style);
  }

  @Post('sync-from-content')
  @ApiOperation({ summary: '扫描正文，同步引用关系' })
  async syncFromContent(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.referenceService.syncCitationsFromContent(taskId);
    return { success: true };
  }

  @Post('reorder')
  @ApiOperation({ summary: '重新编号（按正文出现顺序）' })
  async reorder(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.referenceService.reorderByAppearance(taskId);
    return { success: true };
  }

  @Get(':id')
  @ApiOperation({ summary: '单条文献详情' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('id') id: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.referenceService.findById(taskId, id);
  }

  @Post()
  @ApiOperation({ summary: '手动新增一条' })
  async create(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateReferenceDto,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.referenceService.create(taskId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '修改' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReferenceDto,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.referenceService.update(taskId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除（同时清理正文引用）' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('id') id: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.referenceService.deleteAndCleanup(taskId, id);
    return { success: true };
  }
}
