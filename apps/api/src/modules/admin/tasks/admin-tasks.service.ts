import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  TaskAdminAction,
  TaskStatus,
  UserRole,
  type Prisma,
} from '@prisma/client';
import { Readable } from 'node:stream';
import { PrismaService } from '../../../prisma/prisma.service';
import { TaskService } from '../../task/task.service';
import type {
  BackendTaskStage,
  BackendTaskStatus,
  ListAdminTasksDto,
} from './dto/list-admin-tasks.dto';
import type { BackendTaskStatus as OverrideStatus } from './dto/override-task-status.dto';

type ListAdminTasksItem = {
  id: string;
  title: string | null;
  educationLevel: string;
  status: BackendTaskStatus;
  currentStage: BackendTaskStage;
  deadline: string | null;
  userId: string;
  assignee: { id: string; name: string; email: string | null } | null;
  isLinked: boolean;
  linkedOrderId: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class AdminTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
  ) {}

  private async assertTaskExists(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { id: true, status: true, assigneeId: true, completedAt: true },
    });
    if (!task) throw new NotFoundException('任务不存在');
    return task;
  }

  private normalizeIds(ids: string[]) {
    const normalized = Array.from(
      new Set(ids.map((x) => x.trim()).filter(Boolean)),
    );
    if (normalized.length === 0) throw new BadRequestException('ids 不能为空');
    if (normalized.length > 200)
      throw new BadRequestException('批量操作最多支持 200 条');
    return normalized;
  }

  private buildWhere(dto: ListAdminTasksDto): Prisma.TaskWhereInput {
    const and: Prisma.TaskWhereInput[] = [];

    if (dto.userId) and.push({ userId: dto.userId });
    if (dto.currentStage) and.push({ currentStage: dto.currentStage });

    if (dto.statuses && dto.statuses.length > 0) {
      and.push({
        status: { in: dto.statuses as unknown as TaskStatus[] },
      });
    }

    if (dto.orderNo?.trim()) {
      and.push({
        order: {
          is: {
            orderNo: { contains: dto.orderNo.trim(), mode: 'insensitive' },
          },
        },
      });
    }

    if (dto.createdAtStart || dto.createdAtEnd) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (dto.createdAtStart) createdAt.gte = new Date(dto.createdAtStart);
      if (dto.createdAtEnd) createdAt.lte = new Date(dto.createdAtEnd);
      and.push({ createdAt });
    }

    if (dto.search?.trim()) {
      const k = dto.search.trim();
      and.push({
        OR: [
          { title: { contains: k, mode: 'insensitive' } },
          { id: { contains: k, mode: 'insensitive' } },
          {
            order: { is: { orderNo: { contains: k, mode: 'insensitive' } } },
          },
        ],
      });
    }

    if (dto.linkedOnly) and.push({ order: { isNot: null } });
    if (dto.unlinkedOnly) and.push({ order: { is: null } });

    return and.length > 0 ? { AND: and } : {};
  }

  private buildOrderBy(
    dto: Pick<ListAdminTasksDto, 'sortBy' | 'sortOrder'>,
  ): Prisma.TaskOrderByWithRelationInput {
    return {
      [dto.sortBy ?? 'createdAt']: dto.sortOrder ?? 'desc',
    };
  }

  private mapAssignee(
    u: { id: string; nickname: string | null; email: string | null } | null,
  ) {
    if (!u) return null;
    return {
      id: u.id,
      name: u.nickname ?? u.email ?? u.id,
      email: u.email ?? null,
    };
  }

  private async assertAssignee(assigneeId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, role: true },
    });
    if (!u) throw new BadRequestException('用户不存在');
    const allowed = new Set<UserRole>([
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.TUTOR,
    ]);
    if (!allowed.has(u.role))
      throw new BadRequestException('用户不可被指派为处理人');
    return u;
  }

  async list(dto: ListAdminTasksDto): Promise<{
    items: ListAdminTasksItem[];
    nextCursor: string | null;
    total?: number;
    page?: number;
    pageSize?: number;
  }> {
    if (dto.linkedOnly && dto.unlinkedOnly) {
      throw new BadRequestException('linkedOnly 与 unlinkedOnly 互斥');
    }

    const where = this.buildWhere(dto);

    const isPageMode =
      typeof dto.page === 'number' || typeof dto.pageSize === 'number';
    const orderBy = this.buildOrderBy(dto);

    if (isPageMode) {
      const page = dto.page ?? 1;
      const pageSize = Math.min(dto.pageSize ?? 20, 200);

      const [total, rows] = await this.prisma.$transaction([
        this.prisma.task.count({ where }),
        this.prisma.task.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            title: true,
            educationLevel: true,
            status: true,
            currentStage: true,
            deadline: true,
            userId: true,
            createdAt: true,
            updatedAt: true,
            assignee: { select: { id: true, nickname: true, email: true } },
            order: { select: { id: true } },
          },
        }),
      ]);

      return {
        items: rows.map((t) => ({
          id: t.id,
          title: t.title ?? null,
          educationLevel: t.educationLevel,
          status: t.status,
          currentStage: t.currentStage ?? 'TOPIC',
          deadline: t.deadline ? t.deadline.toISOString() : null,
          userId: t.userId,
          assignee: this.mapAssignee(t.assignee),
          isLinked: Boolean(t.order),
          linkedOrderId: t.order?.id ?? null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
        nextCursor: null,
        total,
        page,
        pageSize,
      };
    }

    const limit = Math.min(dto.limit ?? 20, 100);
    const rows = await this.prisma.task.findMany({
      where,
      orderBy: { id: 'asc' },
      cursor: dto.cursor ? { id: dto.cursor } : undefined,
      skip: dto.cursor ? 1 : 0,
      take: limit + 1,
      select: {
        id: true,
        title: true,
        educationLevel: true,
        status: true,
        currentStage: true,
        deadline: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        assignee: { select: { id: true, nickname: true, email: true } },
        order: { select: { id: true } },
      },
    });

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? (pageItems[pageItems.length - 1]?.id ?? null)
      : null;

    return {
      items: pageItems.map((t) => ({
        id: t.id,
        title: t.title ?? null,
        educationLevel: t.educationLevel,
        status: t.status,
        currentStage: t.currentStage ?? 'TOPIC',
        deadline: t.deadline ? t.deadline.toISOString() : null,
        userId: t.userId,
        assignee: this.mapAssignee(t.assignee),
        isLinked: Boolean(t.order),
        linkedOrderId: t.order?.id ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async detail(id: string) {
    try {
      const detail = await this.taskService.findDetail(id);
      const order = await this.prisma.order.findUnique({
        where: { taskId: id },
        select: {
          id: true,
          orderNo: true,
          status: true,
          amountCents: true,
          paidAmountCents: true,
          discountCents: true,
          createdAt: true,
          paidAt: true,
          user: { select: { id: true, phone: true, nickname: true } },
        },
      });
      const taskRow = await this.prisma.task.findUnique({
        where: { id },
        select: {
          assigneeId: true,
          assignee: { select: { id: true, nickname: true, email: true } },
        },
      });

      return {
        ...detail,
        orders: order
          ? [
              {
                id: order.id,
                orderNo: order.orderNo,
                status: order.status,
                amountCents: order.amountCents,
                paidAmountCents: order.paidAmountCents,
                discountCents: order.discountCents,
                createdAt: order.createdAt,
                paidAt: order.paidAt,
                user: order.user,
              },
            ]
          : [],
        assignee: taskRow?.assignee
          ? {
              id: taskRow.assignee.id,
              name:
                taskRow.assignee.nickname ??
                taskRow.assignee.email ??
                taskRow.assignee.id,
              email: taskRow.assignee.email ?? null,
            }
          : null,
        adminLogs: (
          await this.prisma.taskAdminLog.findMany({
            where: { taskId: id },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              action: true,
              fromStatus: true,
              toStatus: true,
              reason: true,
              content: true,
              assigneeId: true,
              orderId: true,
              createdAt: true,
              operator: { select: { id: true, nickname: true, email: true } },
            },
          })
        ).map((l) => ({
          id: l.id,
          action: l.action,
          fromStatus: l.fromStatus,
          toStatus: l.toStatus,
          reason: l.reason,
          content: l.content,
          assigneeId: l.assigneeId,
          orderId: l.orderId,
          createdAt: l.createdAt,
          operator: {
            id: l.operator.id,
            name: l.operator.nickname ?? l.operator.email ?? l.operator.id,
            email: l.operator.email ?? null,
          },
        })),
      };
    } catch (e: unknown) {
      if (e instanceof NotFoundException) throw e;
      throw e;
    }
  }

  async assign(taskId: string, assigneeId: string, operatorId: string) {
    if (!operatorId) throw new BadRequestException('缺少操作人');
    const task = await this.assertTaskExists(taskId);
    await this.assertAssignee(assigneeId);

    await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id: taskId },
        data: { assigneeId },
        select: { id: true },
      }),
      this.prisma.taskAdminLog.create({
        data: {
          taskId,
          action: TaskAdminAction.ASSIGN,
          operatorId,
          assigneeId,
          meta: { previousAssigneeId: task.assigneeId ?? null },
        },
        select: { id: true },
      }),
    ]);

    return this.detail(taskId);
  }

  async unassign(taskId: string, operatorId: string) {
    if (!operatorId) throw new BadRequestException('缺少操作人');
    const task = await this.assertTaskExists(taskId);

    await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id: taskId },
        data: { assigneeId: null },
        select: { id: true },
      }),
      this.prisma.taskAdminLog.create({
        data: {
          taskId,
          action: TaskAdminAction.UNASSIGN,
          operatorId,
          assigneeId: task.assigneeId ?? null,
        },
        select: { id: true },
      }),
    ]);

    return this.detail(taskId);
  }

  async overrideStatus(
    taskId: string,
    targetStatus: OverrideStatus,
    reason: string,
    operatorId: string,
  ) {
    if (!operatorId) throw new BadRequestException('缺少操作人');
    const task = await this.assertTaskExists(taskId);
    const nextCompletedAt =
      targetStatus === 'DONE' ? (task.completedAt ?? new Date()) : null;

    await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: targetStatus,
          completedAt: nextCompletedAt,
        },
        select: { id: true },
      }),
      this.prisma.taskAdminLog.create({
        data: {
          taskId,
          action: TaskAdminAction.OVERRIDE_STATUS,
          operatorId,
          fromStatus: task.status,
          toStatus: targetStatus,
          reason,
        },
        select: { id: true },
      }),
    ]);

    return this.detail(taskId);
  }

  async addAdminNote(taskId: string, content: string, operatorId: string) {
    if (!operatorId) throw new BadRequestException('缺少操作人');
    await this.assertTaskExists(taskId);
    await this.prisma.taskAdminLog.create({
      data: {
        taskId,
        action: TaskAdminAction.ADD_NOTE,
        operatorId,
        content,
      },
      select: { id: true },
    });

    return this.detail(taskId);
  }

  async batchAssign(ids: string[], assigneeId: string, operatorId: string) {
    if (!operatorId) throw new BadRequestException('缺少操作人');
    const taskIds = this.normalizeIds(ids);
    await this.assertAssignee(assigneeId);

    const tasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, assigneeId: true },
    });
    if (tasks.length !== taskIds.length) {
      const exist = new Set(tasks.map((t) => t.id));
      const missing = taskIds.filter((id) => !exist.has(id));
      throw new NotFoundException(`任务不存在: ${missing.join(', ')}`);
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const t of tasks) {
      ops.push(
        this.prisma.task.update({
          where: { id: t.id },
          data: { assigneeId },
          select: { id: true },
        }),
      );
      ops.push(
        this.prisma.taskAdminLog.create({
          data: {
            taskId: t.id,
            action: TaskAdminAction.ASSIGN,
            operatorId,
            assigneeId,
            meta: { previousAssigneeId: t.assigneeId ?? null },
          },
          select: { id: true },
        }),
      );
    }

    await this.prisma.$transaction(ops);
    return { success: true, affected: taskIds.length };
  }

  async batchOverrideStatus(
    ids: string[],
    targetStatus: OverrideStatus,
    reason: string,
    operatorId: string,
  ) {
    if (!operatorId) throw new BadRequestException('缺少操作人');
    const taskIds = this.normalizeIds(ids);

    const tasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, status: true, completedAt: true },
    });
    if (tasks.length !== taskIds.length) {
      const exist = new Set(tasks.map((t) => t.id));
      const missing = taskIds.filter((id) => !exist.has(id));
      throw new NotFoundException(`任务不存在: ${missing.join(', ')}`);
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const t of tasks) {
      const nextCompletedAt =
        targetStatus === 'DONE' ? (t.completedAt ?? new Date()) : null;
      ops.push(
        this.prisma.task.update({
          where: { id: t.id },
          data: {
            status: targetStatus,
            completedAt: nextCompletedAt,
          },
          select: { id: true },
        }),
      );
      ops.push(
        this.prisma.taskAdminLog.create({
          data: {
            taskId: t.id,
            action: TaskAdminAction.OVERRIDE_STATUS,
            operatorId,
            fromStatus: t.status,
            toStatus: targetStatus,
            reason,
          },
          select: { id: true },
        }),
      );
    }

    await this.prisma.$transaction(ops);
    return { success: true, affected: taskIds.length };
  }

  async batchUnlinkOrders(ids: string[], operatorId: string) {
    if (!operatorId) throw new BadRequestException('缺少操作人');
    const taskIds = this.normalizeIds(ids);

    const tasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true },
    });
    if (tasks.length !== taskIds.length) {
      const exist = new Set(tasks.map((t) => t.id));
      const missing = taskIds.filter((id) => !exist.has(id));
      throw new NotFoundException(`任务不存在: ${missing.join(', ')}`);
    }

    const orders = await this.prisma.order.findMany({
      where: { taskId: { in: taskIds } },
      select: { id: true, taskId: true },
    });

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const o of orders) {
      ops.push(
        this.prisma.order.update({
          where: { id: o.id },
          data: { taskId: null },
          select: { id: true },
        }),
      );
      ops.push(
        this.prisma.taskAdminLog.create({
          data: {
            taskId: o.taskId!,
            action: TaskAdminAction.UNLINK_ORDER,
            operatorId,
            orderId: o.id,
          },
          select: { id: true },
        }),
      );
    }

    await this.prisma.$transaction(ops);
    return { success: true, affectedOrders: orders.length };
  }

  private csvEscape(v: string) {
    const needs = /[",\n\r]/.test(v);
    const s = v.replace(/"/g, '""');
    return needs ? `"${s}"` : s;
  }

  async exportCsv(dto: ListAdminTasksDto): Promise<{
    filename: string;
    content?: string;
    stream?: Readable;
  }> {
    const where = this.buildWhere(dto);
    const sortBy: 'createdAt' | 'updatedAt' = dto.sortBy ?? 'createdAt';
    const sortOrder: Prisma.SortOrder = dto.sortOrder ?? 'desc';

    const total = await this.prisma.task.count({ where });
    const fileDate = new Date().toISOString().slice(0, 10);
    const filename = `tasks_${fileDate}.csv`;

    const header = [
      '任务ID',
      '标题',
      '学历',
      '状态',
      '阶段',
      '创建时间',
      '更新时间',
      '处理人',
      '关联订单数',
    ].join(',');

    const iter = async function* (self: AdminTasksService) {
      yield '\ufeff' + header + '\n';
      const chunkSize = 1000;
      let lastSortValue: Date | null = null;
      let lastId: string | null = null;
      const orderBy: Prisma.TaskOrderByWithRelationInput[] =
        sortBy === 'createdAt'
          ? [{ createdAt: sortOrder }, { id: sortOrder }]
          : [{ updatedAt: sortOrder }, { id: sortOrder }];
      while (true) {
        let pageWhere: Prisma.TaskWhereInput = where;
        if (lastSortValue && lastId) {
          if (sortBy === 'createdAt') {
            pageWhere = {
              AND: [
                where,
                {
                  OR:
                    sortOrder === 'desc'
                      ? [
                          { createdAt: { lt: lastSortValue } },
                          {
                            AND: [
                              { createdAt: lastSortValue },
                              { id: { lt: lastId } },
                            ],
                          },
                        ]
                      : [
                          { createdAt: { gt: lastSortValue } },
                          {
                            AND: [
                              { createdAt: lastSortValue },
                              { id: { gt: lastId } },
                            ],
                          },
                        ],
                },
              ],
            };
          } else {
            pageWhere = {
              AND: [
                where,
                {
                  OR:
                    sortOrder === 'desc'
                      ? [
                          { updatedAt: { lt: lastSortValue } },
                          {
                            AND: [
                              { updatedAt: lastSortValue },
                              { id: { lt: lastId } },
                            ],
                          },
                        ]
                      : [
                          { updatedAt: { gt: lastSortValue } },
                          {
                            AND: [
                              { updatedAt: lastSortValue },
                              { id: { gt: lastId } },
                            ],
                          },
                        ],
                },
              ],
            };
          }
        }

        const rows = await self.prisma.task.findMany({
          where: pageWhere,
          orderBy,
          take: chunkSize,
          select: {
            id: true,
            title: true,
            educationLevel: true,
            status: true,
            currentStage: true,
            createdAt: true,
            updatedAt: true,
            assignee: { select: { id: true, nickname: true, email: true } },
            order: { select: { id: true } },
          },
        });
        if (!rows.length) return;
        for (const t of rows) {
          const assigneeName =
            t.assignee?.nickname ?? t.assignee?.email ?? t.assignee?.id ?? '';
          const line = [
            self.csvEscape(String(t.id)),
            self.csvEscape(String(t.title ?? '')),
            self.csvEscape(String(t.educationLevel)),
            self.csvEscape(String(t.status)),
            self.csvEscape(String(t.currentStage ?? '')),
            self.csvEscape(t.createdAt.toISOString()),
            self.csvEscape(t.updatedAt.toISOString()),
            self.csvEscape(assigneeName),
            self.csvEscape(t.order ? '1' : '0'),
          ].join(',');
          yield line + '\n';
        }
        const last = rows[rows.length - 1];
        lastSortValue =
          sortBy === 'createdAt' ? last.createdAt : last.updatedAt;
        lastId = last.id;
        if (rows.length < chunkSize) return;
      }
    };

    if (total > 5000) {
      return { filename, stream: Readable.from(iter(this)) };
    }

    let out = '\ufeff' + header + '\n';
    for await (const chunk of iter(this)) {
      if (chunk.startsWith('\ufeff')) continue;
      out += chunk;
    }
    return { filename, content: out };
  }
}
