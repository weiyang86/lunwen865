import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import crypto from 'node:crypto';
import {
  Prisma,
  Task as PrismaTask,
  TaskStage,
  TaskStatus as PrismaTaskStatus,
  QuotaType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaService } from '../quota/quota.service';
import { GenerationStage } from './constants/generation-stage.enum';
import { TaskStatus } from './constants/task-status.enum';
import {
  STALLED_CHECK_BATCH_SIZE,
  STALLED_THRESHOLD_MS,
} from './constants/task.constants';
import { InvalidStageException } from './exceptions/invalid-stage.exception';
import { TaskNotFoundException } from './exceptions/task-not-found.exception';
import { TaskStateMachine } from './state-machine/task-state-machine';
import { canAdvanceTo } from './state-machine/stage-rules';
import { calculateProgress } from './utils/progress-calculator.util';
import type {
  PaginatedResult,
  TaskDetail,
  TaskProgress,
} from './interfaces/task-progress.interface';
import type { BootstrapTaskDto } from './dto/bootstrap-task.dto';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { QueryTaskDto } from './dto/query-task.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';
import type {
  TaskTimelineDto,
  TaskTimelineItemDto,
} from './dto/task-timeline.dto';

function serializeTopicToRequirements(dto: CreateTaskDto): string {
  const hasExtra =
    (dto.keywords && dto.keywords.length > 0) ||
    (dto.language && dto.language !== 'zh-CN');

  if (!hasExtra) return dto.topic;

  return JSON.stringify(
    {
      topic: dto.topic,
      keywords: dto.keywords ?? [],
      language: dto.language ?? 'zh-CN',
    },
    null,
    0,
  );
}

function mapPrismaStatusToDomainStatus(status: PrismaTaskStatus): TaskStatus {
  if (status === PrismaTaskStatus.INIT) return TaskStatus.DRAFT;
  if (status === PrismaTaskStatus.DONE) return TaskStatus.COMPLETED;
  if (status === PrismaTaskStatus.FAILED) return TaskStatus.FAILED;
  if (status === PrismaTaskStatus.CANCELLED) return TaskStatus.CANCELLED;
  if (status === PrismaTaskStatus.WRITING_PAUSED) return TaskStatus.PAUSED;
  return TaskStatus.RUNNING;
}

function mapDomainStatusToPrismaStatus(
  target: TaskStatus,
  current: PrismaTaskStatus,
): PrismaTaskStatus {
  if (target === TaskStatus.DRAFT) return PrismaTaskStatus.INIT;
  if (target === TaskStatus.CANCELLED) return PrismaTaskStatus.CANCELLED;
  if (target === TaskStatus.FAILED) return PrismaTaskStatus.FAILED;
  if (target === TaskStatus.COMPLETED) return PrismaTaskStatus.DONE;
  if (target === TaskStatus.PAUSED) return PrismaTaskStatus.WRITING_PAUSED;

  if (target === TaskStatus.STALLED) {
    return PrismaTaskStatus.FAILED;
  }

  if (target === TaskStatus.RUNNING) {
    if (current === PrismaTaskStatus.FAILED)
      return PrismaTaskStatus.TOPIC_GENERATING;
    if (current === PrismaTaskStatus.INIT)
      return PrismaTaskStatus.TOPIC_GENERATING;
    return current;
  }

  return current;
}

function resumeStatusFromStage(stage: TaskStage | null): PrismaTaskStatus {
  if (stage === TaskStage.OPENING) return PrismaTaskStatus.OPENING_GENERATING;
  if (stage === TaskStage.OUTLINE) return PrismaTaskStatus.OUTLINE_GENERATING;
  if (stage === TaskStage.WRITING) return PrismaTaskStatus.WRITING;
  if (stage === TaskStage.MERGING) return PrismaTaskStatus.MERGING;
  if (stage === TaskStage.FORMATTING) return PrismaTaskStatus.FORMATTING;
  if (stage === TaskStage.REVIEW) return PrismaTaskStatus.REVIEW;
  if (stage === TaskStage.REVISION) return PrismaTaskStatus.REVISION;
  return PrismaTaskStatus.TOPIC_GENERATING;
}

function mapPrismaToGenerationStage(task: PrismaTask): GenerationStage {
  if (task.status === PrismaTaskStatus.INIT) return GenerationStage.INIT;
  if (task.status === PrismaTaskStatus.DONE) return GenerationStage.DONE;

  if (
    task.status === PrismaTaskStatus.TOPIC_GENERATING ||
    task.status === PrismaTaskStatus.TOPIC_PENDING_REVIEW ||
    task.status === PrismaTaskStatus.TOPIC_APPROVED
  ) {
    return GenerationStage.TOPIC;
  }
  if (
    task.status === PrismaTaskStatus.OPENING_GENERATING ||
    task.status === PrismaTaskStatus.OPENING_PENDING_REVIEW ||
    task.status === PrismaTaskStatus.OPENING_APPROVED
  ) {
    return GenerationStage.OPENING;
  }
  if (
    task.status === PrismaTaskStatus.OUTLINE_GENERATING ||
    task.status === PrismaTaskStatus.OUTLINE_PENDING_REVIEW ||
    task.status === PrismaTaskStatus.OUTLINE_APPROVED
  ) {
    return GenerationStage.OUTLINE;
  }
  if (task.status === PrismaTaskStatus.MERGING) return GenerationStage.SECTION;
  if (
    task.status === PrismaTaskStatus.FORMATTING ||
    task.status === PrismaTaskStatus.REVIEW ||
    task.status === PrismaTaskStatus.REVISION
  ) {
    return GenerationStage.POLISHING;
  }
  if (
    task.status === PrismaTaskStatus.WRITING ||
    task.status === PrismaTaskStatus.WRITING_PAUSED
  ) {
    return GenerationStage.CHAPTER;
  }

  if (task.currentStage === TaskStage.TOPIC) return GenerationStage.TOPIC;
  if (task.currentStage === TaskStage.OPENING) return GenerationStage.OPENING;
  if (task.currentStage === TaskStage.OUTLINE) return GenerationStage.OUTLINE;
  if (task.currentStage === TaskStage.WRITING) return GenerationStage.CHAPTER;
  if (task.currentStage === TaskStage.MERGING) return GenerationStage.SECTION;
  if (task.currentStage === TaskStage.FORMATTING)
    return GenerationStage.POLISHING;

  return GenerationStage.INIT;
}

function mapGenerationStageToPrismaStage(stage: GenerationStage): TaskStage {
  if (stage === GenerationStage.TOPIC || stage === GenerationStage.INIT)
    return TaskStage.TOPIC;
  if (stage === GenerationStage.OPENING) return TaskStage.OPENING;
  if (stage === GenerationStage.OUTLINE) return TaskStage.OUTLINE;
  if (stage === GenerationStage.CHAPTER) return TaskStage.WRITING;
  if (stage === GenerationStage.SECTION) return TaskStage.MERGING;
  if (stage === GenerationStage.SUMMARY) return TaskStage.MERGING;
  if (stage === GenerationStage.POLISHING) return TaskStage.FORMATTING;
  return TaskStage.REVIEW;
}

function mapDomainStatusFilterToPrismaStatuses(
  status: TaskStatus,
): PrismaTaskStatus[] {
  if (status === TaskStatus.DRAFT) return [PrismaTaskStatus.INIT];
  if (status === TaskStatus.PAUSED) return [PrismaTaskStatus.WRITING_PAUSED];
  if (status === TaskStatus.COMPLETED) return [PrismaTaskStatus.DONE];
  if (status === TaskStatus.FAILED) return [PrismaTaskStatus.FAILED];
  if (status === TaskStatus.CANCELLED) return [PrismaTaskStatus.CANCELLED];
  if (status === TaskStatus.RUNNING) {
    return Object.values(PrismaTaskStatus).filter(
      (s) =>
        s !== PrismaTaskStatus.INIT &&
        s !== PrismaTaskStatus.DONE &&
        s !== PrismaTaskStatus.FAILED &&
        s !== PrismaTaskStatus.CANCELLED &&
        s !== PrismaTaskStatus.WRITING_PAUSED,
    );
  }
  return [];
}

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: QuotaService,
  ) {}

  private async resolveSchoolId(input?: string): Promise<string> {
    const raw = input?.trim();
    if (!raw) {
      const existed = await this.prisma.school.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (existed) return existed.id;

      const created = await this.prisma.school.create({
        data: { name: '默认学校', code: 'default-school' },
        select: { id: true },
      });
      return created.id;
    }

    const byId = await this.prisma.school.findUnique({
      where: { id: raw },
      select: { id: true },
    });
    if (byId) return byId.id;

    const normalizedName = raw.replace(/\s+/g, ' ').trim();
    const byName = await this.prisma.school.findFirst({
      where: { name: normalizedName },
      select: { id: true },
    });
    if (byName) return byName.id;

    const nameHash = crypto
      .createHash('sha1')
      .update(normalizedName, 'utf8')
      .digest('hex')
      .slice(0, 10);
    const code = `name-${nameHash}`;

    const created = await this.prisma.school.create({
      data: { name: normalizedName, code },
      select: { id: true },
    });
    return created.id;
  }

  async assertTaskOwnership(taskId: string, userId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, userId: true },
    });
    if (!task) throw new TaskNotFoundException(taskId);
    if (task.userId !== userId) throw new ForbiddenException('无权访问该任务');
  }

  /**
   * 创建任务（初始 status=DRAFT, stage=INIT）
   */

  async bootstrapTask(
    userId: string,
    dto: BootstrapTaskDto,
  ): Promise<PrismaTask> {
    const now = new Date();
    const seed = now.toISOString().slice(0, 10);
    const schoolId = await this.resolveSchoolId(dto.schoolId);
    return this.createTask(userId, {
      schoolId,
      major: dto.major?.trim() || '未指定专业',
      educationLevel: dto.educationLevel?.trim() || '本科',
      title: dto.title?.trim() || `论文任务 ${seed}`,
      topic: dto.topic?.trim() || '请先生成可执行的论文题目候选',
      language: 'zh-CN',
    });
  }

  async createTask(userId: string, dto: CreateTaskDto): Promise<PrismaTask> {
    try {
      await this.quotaService.ensure(userId, QuotaType.PAPER_GENERATION, 1);
      const requirements = serializeTopicToRequirements(dto);

      return await this.prisma.task.create({
        data: {
          userId,
          schoolId: dto.schoolId,
          major: dto.major,
          educationLevel: dto.educationLevel,
          title: dto.title,
          requirements,
          totalWordCount: dto.wordCountTarget,
          deadline: dto.deadline ? new Date(dto.deadline) : undefined,
          status: PrismaTaskStatus.INIT,
          currentStage: TaskStage.TOPIC,
        },
      });
    } catch (error: unknown) {
      this.logger.error('创建任务失败', error);
      if (error instanceof HttpException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          '关联字段不合法：userId 或 schoolId 不存在',
        );
      }
      throw new BadRequestException('创建任务失败');
    }
  }

  /**
   * 根据 id 查询单个任务（含基本信息，不含 chapters）
   */
  async findById(id: string, userId?: string): Promise<PrismaTask> {
    try {
      if (userId) await this.assertTaskOwnership(id, userId);
      const task = await this.prisma.task.findUnique({ where: { id } });
      if (!task) throw new TaskNotFoundException(id);
      return task;
    } catch (error: unknown) {
      if (error instanceof TaskNotFoundException) throw error;
      if (error instanceof ForbiddenException) throw error;
      this.logger.error('查询任务失败', error);
      throw new BadRequestException('查询任务失败');
    }
  }

  /**
   * 查询任务详情（含 chapters / sections / 进度等完整信息）
   */
  async findDetail(id: string, userId?: string): Promise<TaskDetail> {
    try {
      if (userId) await this.assertTaskOwnership(id, userId);
      const task = await this.prisma.task.findUnique({
        where: { id },
        include: {
          chapters: {
            include: { sections: true },
            orderBy: { index: 'asc' },
          },
        },
      });
      if (!task) throw new TaskNotFoundException(id);

      const progress = await this.buildProgress(task.id);

      return {
        task,
        progress,
      };
    } catch (error: unknown) {
      if (error instanceof TaskNotFoundException) throw error;
      if (error instanceof ForbiddenException) throw error;
      this.logger.error('查询任务详情失败', error);
      throw new BadRequestException('查询任务详情失败');
    }
  }

  private resolveAgencyId(currentUser: Record<string, unknown>): string {
    const raw = currentUser['agencyId'];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
    throw new ForbiddenException('当前账号无机构归属，禁止访问机构任务时间线');
  }

  async getTimelineForAgency(
    taskId: string,
    currentUser: Record<string, unknown>,
  ): Promise<TaskTimelineDto> {
    const agencyId = this.resolveAgencyId(currentUser);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        order: {
          select: {
            id: true,
            agencyId: true,
            sourceType: true,
          },
        },
      },
    });

    if (!task) throw new TaskNotFoundException(taskId);

    if (!task.order || task.order.sourceType !== 'AGENCY') {
      throw new ForbiddenException('该任务未关联机构订单，禁止访问');
    }

    if (task.order.agencyId !== agencyId) {
      throw new ForbiddenException('无权访问该机构任务时间线');
    }

    return this.getTimeline(taskId);
  }

  async getTimeline(id: string, userId?: string): Promise<TaskTimelineDto> {
    if (userId) await this.assertTaskOwnership(id, userId);

    const task = await this.prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        currentStage: true,
        createdAt: true,
        updatedAt: true,
        order: {
          select: { id: true, orderNo: true, status: true, createdAt: true },
        },
        adminLogs: {
          select: {
            id: true,
            action: true,
            operatorId: true,
            fromStatus: true,
            toStatus: true,
            orderId: true,
            reason: true,
            content: true,
            meta: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) throw new TaskNotFoundException(id);

    const items: TaskTimelineItemDto[] = [
      {
        id: `${task.id}_created`,
        type: 'TASK_CREATED',
        title: '任务已创建',
        description: '任务进入系统，等待后续推进。',
        createdAt: task.createdAt,
        status: task.status,
        stage: task.currentStage,
      },
    ];

    if (task.order) {
      items.push({
        id: `${task.id}_order_linked`,
        type: 'ORDER_LINKED',
        title: '订单已关联',
        description: `关联订单 ${task.order.orderNo}（${task.order.status}）`,
        createdAt: task.order.createdAt,
        orderId: task.order.id,
        status: task.status,
        stage: task.currentStage,
      });
    }

    for (const log of task.adminLogs) {
      const base: TaskTimelineItemDto = {
        id: log.id,
        type: 'ADMIN_ACTION',
        title: `管理操作：${log.action}`,
        description: log.reason ?? log.content ?? '无附加说明',
        createdAt: log.createdAt,
        operatorId: log.operatorId,
        status: log.toStatus ?? task.status,
        stage: task.currentStage,
        orderId: log.orderId,
        meta: (log.meta as Record<string, unknown> | null) ?? null,
      };
      items.push(base);

      if (log.fromStatus && log.toStatus && log.fromStatus !== log.toStatus) {
        items.push({
          id: `${log.id}_status_changed`,
          type: 'STATUS_CHANGED',
          title: '任务状态变更',
          description: `${log.fromStatus} → ${log.toStatus}`,
          createdAt: log.createdAt,
          operatorId: log.operatorId,
          status: log.toStatus,
          stage: task.currentStage,
          orderId: log.orderId,
        });
      }
    }

    if (
      items.every((it) => it.createdAt.getTime() !== task.updatedAt.getTime())
    ) {
      items.push({
        id: `${task.id}_updated`,
        type: 'UPDATED',
        title: '任务最近更新',
        description: '任务信息发生更新。',
        createdAt: task.updatedAt,
        status: task.status,
        stage: task.currentStage,
      });
    }

    items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return {
      taskId: task.id,
      currentStatus: task.status,
      currentStage: task.currentStage,
      updatedAt: task.updatedAt,
      items,
    };
  }

  /**
   * 分页查询任务列表（按 createdAt 倒序）
   */
  async findList(
    userId: string,
    query: QueryTaskDto,
  ): Promise<PaginatedResult<PrismaTask>> {
    try {
      const where: Prisma.TaskWhereInput = { userId };

      if (query.status) {
        const statuses = mapDomainStatusFilterToPrismaStatuses(query.status);
        if (statuses.length === 0) {
          return {
            items: [],
            page: query.page,
            pageSize: query.pageSize,
            total: 0,
          };
        }
        where.status = { in: statuses };
      }

      if (query.educationLevel) {
        where.educationLevel = query.educationLevel;
      }

      if (query.keyword) {
        where.OR = [
          { title: { contains: query.keyword, mode: 'insensitive' } },
          { requirements: { contains: query.keyword, mode: 'insensitive' } },
          { major: { contains: query.keyword, mode: 'insensitive' } },
        ];
      }

      const orderBy: Prisma.TaskOrderByWithRelationInput = {
        [query.sortBy]: query.sortOrder,
      };

      const [total, items] = await this.prisma.$transaction([
        this.prisma.task.count({ where }),
        this.prisma.task.findMany({
          where,
          orderBy,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);

      return {
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    } catch (error: unknown) {
      this.logger.error('查询任务列表失败', error);
      throw new BadRequestException('查询任务列表失败');
    }
  }

  /**
   * 更新任务基础信息（仅 DRAFT 状态可改全部字段，其他状态只允许改 title）
   */
  async updateTask(
    id: string,
    dto: UpdateTaskDto,
    userId?: string,
  ): Promise<PrismaTask> {
    try {
      if (userId) await this.assertTaskOwnership(id, userId);
      return await this.prisma.$transaction(async (tx) => {
        const task = await tx.task.findUnique({ where: { id } });
        if (!task) throw new TaskNotFoundException(id);

        const domainStatus = mapPrismaStatusToDomainStatus(task.status);
        const canEditAll = domainStatus === TaskStatus.DRAFT;

        const data: Prisma.TaskUpdateManyMutationInput = {};
        if (dto.title !== undefined) data.title = dto.title;
        if (canEditAll) {
          if (dto.topic !== undefined) data.requirements = dto.topic;
          if (dto.wordCountTarget !== undefined)
            data.totalWordCount = dto.wordCountTarget;
        }

        const result = await tx.task.updateMany({
          where: { id, status: task.status },
          data,
        });

        if (result.count === 0) {
          throw new ConflictException('任务已被更新，请重试');
        }

        const updated = await tx.task.findUnique({ where: { id } });
        if (!updated) throw new TaskNotFoundException(id);
        return updated;
      });
    } catch (error: unknown) {
      if (
        error instanceof TaskNotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error('更新任务失败', error);
      throw new BadRequestException('更新任务失败');
    }
  }

  /**
   * 删除任务（软删除，标记为 CANCELLED；如果是 DRAFT 则物理删除）
   */
  async deleteTask(id: string, userId?: string): Promise<void> {
    try {
      if (userId) await this.assertTaskOwnership(id, userId);
      await this.prisma.$transaction(async (tx) => {
        const task = await tx.task.findUnique({ where: { id } });
        if (!task) throw new TaskNotFoundException(id);

        const domainStatus = mapPrismaStatusToDomainStatus(task.status);
        if (domainStatus === TaskStatus.DRAFT) {
          await tx.task.delete({ where: { id } });
          return;
        }

        const result = await tx.task.updateMany({
          where: { id, status: task.status },
          data: { status: PrismaTaskStatus.CANCELLED },
        });

        if (result.count === 0) {
          throw new ConflictException('任务已被更新，请重试');
        }
      });
    } catch (error: unknown) {
      if (
        error instanceof TaskNotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error('删除任务失败', error);
      throw new BadRequestException('删除任务失败');
    }
  }

  /**
   * 切换任务状态（必须经过状态机校验）
   * 跃迁不合法时抛 InvalidTaskTransitionException
   */
  async changeStatus(
    id: string,
    targetStatus: TaskStatus,
    reason?: string,
    userId?: string,
  ): Promise<PrismaTask> {
    try {
      if (userId) await this.assertTaskOwnership(id, userId);
      return await this.prisma.$transaction(async (tx) => {
        const task = await tx.task.findUnique({ where: { id } });
        if (!task) throw new TaskNotFoundException(id);

        const from = mapPrismaStatusToDomainStatus(task.status);
        TaskStateMachine.assertCanTransition(from, targetStatus);

        const nextPrismaStatus =
          targetStatus === TaskStatus.RUNNING &&
          task.status === PrismaTaskStatus.WRITING_PAUSED
            ? resumeStatusFromStage(task.currentStage)
            : mapDomainStatusToPrismaStatus(targetStatus, task.status);

        const updateData: Prisma.TaskUpdateManyMutationInput = {
          status: nextPrismaStatus,
        };

        if (targetStatus === TaskStatus.COMPLETED) {
          updateData.completedAt = new Date();
        }

        if (targetStatus === TaskStatus.CANCELLED && reason) {
          updateData.requirements = task.requirements
            ? `${task.requirements}\n\n[CANCEL_REASON] ${reason}`
            : `[CANCEL_REASON] ${reason}`;
        }

        const result = await tx.task.updateMany({
          where: { id, status: task.status },
          data: updateData,
        });

        if (result.count === 0) {
          throw new ConflictException('任务已被更新，请重试');
        }

        const updated = await tx.task.findUnique({ where: { id } });
        if (!updated) throw new TaskNotFoundException(id);
        return updated;
      });
    } catch (error: unknown) {
      if (
        error instanceof TaskNotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * 推进生成阶段（targetStage 必须 ≥ 当前 stage）
   */
  async advanceStage(
    id: string,
    targetStage: GenerationStage,
    userId?: string,
  ): Promise<PrismaTask> {
    try {
      if (userId) await this.assertTaskOwnership(id, userId);
      return await this.prisma.$transaction(async (tx) => {
        const task = await tx.task.findUnique({ where: { id } });
        if (!task) throw new TaskNotFoundException(id);

        const currentStage = mapPrismaToGenerationStage(task);
        if (!canAdvanceTo(currentStage, targetStage)) {
          throw new InvalidStageException(currentStage, targetStage);
        }

        const prismaStage = mapGenerationStageToPrismaStage(targetStage);
        const result = await tx.task.updateMany({
          where: { id, status: task.status },
          data: { currentStage: prismaStage },
        });

        if (result.count === 0) {
          throw new ConflictException('任务已被更新，请重试');
        }

        const updated = await tx.task.findUnique({ where: { id } });
        if (!updated) throw new TaskNotFoundException(id);
        return updated;
      });
    } catch (error: unknown) {
      if (
        error instanceof TaskNotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException ||
        error instanceof InvalidStageException
      ) {
        throw error;
      }
      this.logger.error('推进阶段失败', error);
      throw new BadRequestException('推进阶段失败');
    }
  }

  /**
   * 启动任务（DRAFT → RUNNING，并设置 startedAt）
   */
  async startTask(id: string, userId?: string): Promise<PrismaTask> {
    return this.changeStatus(id, TaskStatus.RUNNING, undefined, userId);
  }

  /**
   * 暂停任务（RUNNING → PAUSED）
   */
  async pauseTask(id: string, userId?: string): Promise<PrismaTask> {
    return this.changeStatus(id, TaskStatus.PAUSED, undefined, userId);
  }

  /**
   * 恢复任务（PAUSED/STALLED → RUNNING）
   */
  async resumeTask(id: string, userId?: string): Promise<PrismaTask> {
    return this.changeStatus(id, TaskStatus.RUNNING, undefined, userId);
  }

  /**
   * 取消任务（→ CANCELLED）
   */
  async cancelTask(
    id: string,
    reason?: string,
    userId?: string,
  ): Promise<PrismaTask> {
    return this.changeStatus(id, TaskStatus.CANCELLED, reason, userId);
  }

  /**
   * 完成任务（RUNNING → COMPLETED，设置 completedAt, progress=100）
   */
  async completeTask(id: string, userId?: string): Promise<PrismaTask> {
    if (userId) await this.assertTaskOwnership(id, userId);

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({ where: { id } });
      if (!task) throw new TaskNotFoundException(id);

      const from = mapPrismaStatusToDomainStatus(task.status);
      TaskStateMachine.assertCanTransition(from, TaskStatus.COMPLETED);

      const nextPrismaStatus = mapDomainStatusToPrismaStatus(
        TaskStatus.COMPLETED,
        task.status,
      );

      const result = await tx.task.updateMany({
        where: { id, status: task.status },
        data: { status: nextPrismaStatus, completedAt: new Date() },
      });
      if (result.count === 0) {
        throw new ConflictException('任务已被更新，请重试');
      }

      const updated = await tx.task.findUnique({ where: { id } });
      if (!updated) throw new TaskNotFoundException(id);

      await this.quotaService.consume({
        userId: updated.userId,
        type: QuotaType.PAPER_GENERATION,
        amount: 1,
        bizId: updated.id,
        remark: `论文生成: ${updated.title ?? updated.id}`,
        tx,
      });

      return updated;
    });
  }

  /**
   * 标记任务失败（→ FAILED，记录 errorMessage）
   */
  async markFailed(
    id: string,
    errorMessage: string,
    userId?: string,
  ): Promise<PrismaTask> {
    return this.changeStatus(id, TaskStatus.FAILED, errorMessage, userId);
  }

  /**
   * 重试任务（FAILED → RUNNING，清除 errorMessage）
   */
  async retryTask(id: string, userId?: string): Promise<PrismaTask> {
    return this.changeStatus(id, TaskStatus.RUNNING, undefined, userId);
  }

  /**
   * 重新计算任务进度并更新到数据库
   */
  async recalculateProgress(id: string, userId?: string): Promise<number> {
    if (userId) await this.assertTaskOwnership(id, userId);
    const progress = await this.buildProgress(id);
    return progress.progress;
  }

  /**
   * 查询任务进度（不落库）
   */
  async getProgress(id: string, userId?: string): Promise<TaskProgress> {
    if (userId) await this.assertTaskOwnership(id, userId);
    return this.buildProgress(id);
  }

  /**
   * 供其他模块在生成成功后调用，更新 stage 和进度
   */
  async onStageCompleted(
    id: string,
    completedStage: GenerationStage,
    userId?: string,
  ): Promise<void> {
    await this.advanceStage(id, completedStage, userId);
    await this.recalculateProgress(id, userId);
  }

  /**
   * 供其他模块在生成失败后调用
   */
  async onStageFailed(
    id: string,
    failedStage: GenerationStage,
    errorMessage: string,
    userId?: string,
  ): Promise<void> {
    await this.advanceStage(id, failedStage, userId);
    await this.markFailed(id, errorMessage, userId);
  }

  /**
   * 检测超时任务（用于定时任务调用）
   */
  async detectStalledTasks(): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - STALLED_THRESHOLD_MS);

      const ids = await this.prisma.task.findMany({
        where: {
          status: {
            in: mapDomainStatusFilterToPrismaStatuses(TaskStatus.RUNNING),
          },
          updatedAt: { lt: cutoff },
        },
        select: { id: true },
        take: STALLED_CHECK_BATCH_SIZE,
        orderBy: { updatedAt: 'asc' },
      });

      if (ids.length === 0) return 0;

      const result = await this.prisma.task.updateMany({
        where: { id: { in: ids.map((x) => x.id) } },
        data: {
          status: PrismaTaskStatus.FAILED,
        },
      });

      return result.count;
    } catch (error: unknown) {
      this.logger.error('检测超时任务失败', error);
      return 0;
    }
  }

  private async buildProgress(taskId: string): Promise<TaskProgress> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new TaskNotFoundException(taskId);

    const stage = mapPrismaToGenerationStage(task);
    const domainStatus = mapPrismaStatusToDomainStatus(task.status);

    const [chapterStats, sectionStats] = await Promise.all([
      this.getChapterStats(taskId),
      this.getSectionStats(taskId),
    ]);

    const effectiveStage =
      sectionStats.total > 0 && stage === GenerationStage.CHAPTER
        ? GenerationStage.SECTION
        : stage;

    const progress = calculateProgress(
      effectiveStage,
      chapterStats,
      sectionStats,
    );

    return {
      taskId,
      status: domainStatus,
      stage: effectiveStage,
      progress,
    };
  }

  private async getChapterStats(
    taskId: string,
  ): Promise<{ total: number; completed: number }> {
    const [total, completed] = await this.prisma.$transaction([
      this.prisma.chapter.count({ where: { taskId } }),
      this.prisma.chapter.count({
        where: { taskId, status: 'COMPLETED' },
      }),
    ]);

    return { total, completed };
  }

  private async getSectionStats(
    taskId: string,
  ): Promise<{ total: number; completed: number }> {
    const chapters = await this.prisma.chapter.findMany({
      where: { taskId },
      select: { id: true },
    });

    const chapterIds = chapters.map((c) => c.id);
    if (chapterIds.length === 0) return { total: 0, completed: 0 };

    const [total, completed] = await this.prisma.$transaction([
      this.prisma.section.count({ where: { chapterId: { in: chapterIds } } }),
      this.prisma.section.count({
        where: { chapterId: { in: chapterIds }, status: 'COMPLETED' },
      }),
    ]);

    return { total, completed };
  }
}
