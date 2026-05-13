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
import { CancelTaskDto } from './dto/cancel-task.dto';
import { BootstrapTaskDto } from './dto/bootstrap-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskService } from './task.service';

@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  private assertTaskOwnership(taskId: string, userId: string): Promise<void> {
    return this.taskService.assertTaskOwnership(taskId, userId);
  }

  @Post()
  @ApiOperation({ summary: '创建任务' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateTaskDto) {
    return this.taskService.createTask(userId, dto);
  }

  @Post('bootstrap')
  @ApiOperation({ summary: '客户端快速创建任务（最小必填）' })
  async bootstrap(
    @CurrentUser('id') userId: string,
    @Body() dto: BootstrapTaskDto,
  ) {
    return this.taskService.bootstrapTask(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: '我的任务列表（客户端）' })
  async myTasks(
    @CurrentUser('id') userId: string,
    @Query() query: QueryTaskDto,
  ) {
    return this.taskService.findList(userId, query);
  }

  @Get()
  @ApiOperation({ summary: '分页列表（支持 status、educationLevel 过滤）' })
  async list(@CurrentUser('id') userId: string, @Query() query: QueryTaskDto) {
    return this.taskService.findList(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '任务基本信息' })
  async findById(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.assertTaskOwnership(id, userId);
    return this.taskService.findById(id, userId);
  }

  @Get(':id/detail')
  @ApiOperation({ summary: '任务详情（含 chapters / sections / 进度）' })
  async detail(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.assertTaskOwnership(id, userId);
    return this.taskService.findDetail(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新任务基础信息' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    await this.assertTaskOwnership(id, userId);
    return this.taskService.updateTask(id, dto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除/取消任务' })
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.assertTaskOwnership(id, userId);
    await this.taskService.deleteTask(id, userId);
    return { success: true };
  }

  @Post(':id/start')
  @ApiOperation({ summary: '启动任务' })
  async start(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.assertTaskOwnership(id, userId);
    return this.taskService.startTask(id, userId);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: '暂停任务' })
  async pause(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.assertTaskOwnership(id, userId);
    return this.taskService.pauseTask(id, userId);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: '恢复任务' })
  async resume(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.assertTaskOwnership(id, userId);
    return this.taskService.resumeTask(id, userId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: '取消任务' })
  async cancel(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: CancelTaskDto,
  ) {
    await this.assertTaskOwnership(id, userId);
    return this.taskService.cancelTask(id, dto.reason, userId);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: '重试任务' })
  async retry(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.assertTaskOwnership(id, userId);
    return this.taskService.retryTask(id, userId);
  }

  @Post(':id/recalculate-progress')
  @ApiOperation({ summary: '强制重算进度（调试用）' })
  async recalc(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.assertTaskOwnership(id, userId);
    const progress = await this.taskService.recalculateProgress(id, userId);
    return { progress };
  }

  @Get(':id/progress')
  @ApiOperation({ summary: '查询进度' })
  async progress(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.assertTaskOwnership(id, userId);
    return this.taskService.getProgress(id, userId);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: '任务时间线（含订单摘要与关键事件）' })
  async timeline(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.assertTaskOwnership(id, userId);
    return this.taskService.getTimeline(id, userId);
  }
}
