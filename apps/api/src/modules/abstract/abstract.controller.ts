import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaskService } from '../task/task.service';
import { AbstractService } from './abstract.service';
import { GenerateAbstractDto } from './dto/generate-abstract.dto';
import { UpdateAbstractDto } from './dto/update-abstract.dto';

@Controller('tasks/:taskId/abstract')
export class AbstractController {
  constructor(
    private readonly abstractService: AbstractService,
    private readonly taskService: TaskService,
  ) {}

  @Get()
  @ApiOperation({ summary: '查询最新摘要（中/英文）' })
  async latest(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.abstractService.getLatest(taskId);
  }

  @Get('history')
  @ApiOperation({ summary: '查询摘要历史记录（含修改意见与结果）' })
  async history(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.abstractService.getHistory(taskId);
  }

  @Post('generate')
  @ApiOperation({ summary: '生成/重生成摘要（中/英文）' })
  async generate(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: GenerateAbstractDto,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.abstractService.generate(taskId, dto);
  }

  @Patch()
  @ApiOperation({ summary: '手工修改摘要（生成新版本）' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateAbstractDto,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.abstractService.updateManually(taskId, dto);
  }

  @Post('confirm')
  @ApiOperation({ summary: '确认摘要（推进到 ABSTRACT_APPROVED）' })
  async confirm(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.abstractService.confirm(taskId);
  }
}
