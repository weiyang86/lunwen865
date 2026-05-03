import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaskService } from '../task/task.service';
import { CreateNodeDto } from './dto/create-node.dto';
import { GenerateOutlineDto } from './dto/generate-outline.dto';
import { MoveNodeDto } from './dto/move-node.dto';
import { RegenerateSectionDto } from './dto/regenerate-section.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { OutlineNodeService } from './outline-node.service';
import { OutlineService } from './outline.service';

@Controller('tasks/:taskId/outline')
export class OutlineController {
  constructor(
    private readonly outlineService: OutlineService,
    private readonly outlineNodeService: OutlineNodeService,
    private readonly taskService: TaskService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: '生成大纲（首次或覆盖）' })
  async generate(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: GenerateOutlineDto,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.outlineService.generate(taskId, dto);
  }

  @Get()
  @ApiOperation({ summary: '查询大纲（嵌套树）' })
  async findByTaskId(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.outlineService.findByTaskId(taskId);
  }

  @Get('flat')
  @ApiOperation({ summary: '查询大纲（扁平列表）' })
  async findFlat(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.outlineService.findFlatByTaskId(taskId);
  }

  @Post('nodes')
  @ApiOperation({ summary: '新增节点' })
  async createNode(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateNodeDto,
  ): Promise<unknown> {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.outlineNodeService.createNode(taskId, dto);
  }

  @Patch('nodes/:nodeId')
  @ApiOperation({ summary: '更新节点（标题/字数/摘要）' })
  async updateNode(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: UpdateNodeDto,
  ): Promise<unknown> {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.outlineNodeService.updateNode(taskId, nodeId, dto);
  }

  @Delete('nodes/:nodeId')
  @ApiOperation({ summary: '删除节点（级联子节点）' })
  async deleteNode(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('nodeId') nodeId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.outlineNodeService.deleteNode(taskId, nodeId);
    return { success: true };
  }

  @Post('nodes/:nodeId/move')
  @ApiOperation({ summary: '移动节点' })
  async moveNode(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: MoveNodeDto,
  ): Promise<unknown> {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.outlineNodeService.moveNode(taskId, nodeId, dto);
  }

  @Post('nodes/:nodeId/regenerate')
  @ApiOperation({ summary: '重新生成单章/节内容' })
  async regenerateSection(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: RegenerateSectionDto,
  ): Promise<unknown> {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.outlineNodeService.regenerateSection(taskId, nodeId, dto);
  }

  @Post('lock')
  @ApiOperation({ summary: '锁定大纲（推进 stage）' })
  async lock(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.outlineService.lock(taskId);
  }

  @Post('unlock')
  @ApiOperation({ summary: '解锁大纲' })
  async unlock(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.outlineService.unlock(taskId);
  }

  @Post('redistribute-words')
  @ApiOperation({ summary: '重新分配字数（按比例）' })
  async redistributeWords(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    return this.outlineService.redistributeWords(taskId);
  }

  @Delete()
  @ApiOperation({ summary: '删除整个大纲' })
  async deleteOutline(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.assertTaskOwnership(taskId, userId);
    await this.outlineService.deleteOutline(taskId);
    return { success: true };
  }
}
