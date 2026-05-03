import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaskService } from '../task/task.service';
import { GenerateTopicDto } from './dto/generate-topic.dto';
import { RegenerateTopicDto } from './dto/regenerate-topic.dto';
import { TopicService } from './topic.service';

@Controller('tasks/:taskId/topics')
export class TopicController {
  constructor(
    private readonly topicService: TopicService,
    private readonly taskService: TaskService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: '生成候选题目（首次）' })
  async generate(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: GenerateTopicDto,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.topicService.generateTopics(taskId, dto);
  }

  @Post('regenerate')
  @ApiOperation({ summary: '重新生成（带反馈）' })
  async regenerate(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: RegenerateTopicDto,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.topicService.regenerateTopics(taskId, dto);
  }

  @Get()
  @ApiOperation({ summary: '查询所有候选' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.topicService.findCandidatesByTaskId(taskId);
  }

  @Get('latest')
  @ApiOperation({ summary: '查询最新一批候选' })
  async findLatest(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.topicService.findLatestCandidates(taskId);
  }

  @Get(':candidateId')
  @ApiOperation({ summary: '查询单个候选' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('candidateId') candidateId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.topicService.findCandidateById(candidateId);
  }

  @Post(':candidateId/select')
  @ApiOperation({ summary: '选定题目' })
  async select(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('candidateId') candidateId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.topicService.selectTopic(taskId, candidateId);
  }

  @Post('unselect')
  @ApiOperation({ summary: '取消选定' })
  async unselect(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.topicService.unselectTopic(taskId);
    return { success: true };
  }

  @Delete('batch/:batch')
  @ApiOperation({ summary: '删除某轮候选（仅未被选中的可删）' })
  async deleteBatch(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('batch') batch: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    const deleted = await this.topicService.deleteCandidatesByBatch(
      taskId,
      Number(batch),
    );
    return { deleted };
  }
}
