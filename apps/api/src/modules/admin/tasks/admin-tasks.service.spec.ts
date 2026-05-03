import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../prisma/prisma.service';
import type { TaskService } from '../../task/task.service';
import { ListAdminTasksDto } from './dto/list-admin-tasks.dto';
import { AdminTasksService } from './admin-tasks.service';

type PrismaMock = {
  task: {
    findMany: (args: unknown) => Promise<unknown[]>;
    count: (args: unknown) => Promise<number>;
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  order: {
    findUnique: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    update: (args: unknown) => Promise<unknown>;
  };
  user: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
  taskAdminLog: {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
  };
  $transaction: (args: Promise<unknown>[]) => Promise<unknown[]>;
};

describe('AdminTasksService (admin)', () => {
  let prisma: DeepMockProxy<PrismaMock>;
  let taskService: DeepMockProxy<Pick<TaskService, 'findDetail'>>;
  let service: AdminTasksService;

  beforeEach(() => {
    prisma = mockDeep<PrismaMock>();
    taskService = mockDeep<Pick<TaskService, 'findDetail'>>();
    prisma.$transaction.mockImplementation(async (args) => Promise.all(args));
    service = new AdminTasksService(
      prisma as unknown as PrismaService,
      taskService as unknown as TaskService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeDto(patch: Partial<ListAdminTasksDto> = {}) {
    const dto = new ListAdminTasksDto();
    Object.assign(dto, patch);
    return dto;
  }

  function asRecord(v: unknown): Record<string, unknown> {
    if (v && typeof v === 'object') return v as Record<string, unknown>;
    return {};
  }

  function asArray(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
  }

  async function collectStream(stream: NodeJS.ReadableStream) {
    const chunks: string[] = [];
    for await (const c of stream) chunks.push(String(c));
    return chunks.join('');
  }

  function makeMockDetail(): Awaited<ReturnType<AdminTasksService['detail']>> {
    return {
      task: {} as unknown as Awaited<
        ReturnType<Pick<TaskService, 'findDetail'>['findDetail']>
      >['task'],
      progress: {} as unknown as Awaited<
        ReturnType<Pick<TaskService, 'findDetail'>['findDetail']>
      >['progress'],
      orders: [],
      assignee: null,
      adminLogs: [],
    };
  }

  it('list: 不传 userId → 允许返回所有 task（全局视图）', async () => {
    prisma.task.findMany.mockResolvedValueOnce([
      {
        id: 't1',
        title: 'A',
        educationLevel: 'MASTER',
        status: 'INIT',
        currentStage: 'OUTLINE',
        deadline: null,
        userId: 'u1',
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-02T00:00:00.000Z'),
        order: null,
      },
    ]);

    const res = await service.list(makeDto({ limit: 20 }));
    expect(res.items).toHaveLength(1);
    expect(res.items[0].id).toBe('t1');
  });

  it('list: 传 userId → where.userId 生效', async () => {
    prisma.task.findMany.mockResolvedValueOnce([]);
    await service.list(makeDto({ userId: 'u1', limit: 20 }));

    const arg0 = prisma.task.findMany.mock.calls[0]?.[0];
    const where = asRecord(asRecord(arg0).where);
    const and = asArray(where['AND']).map(asRecord);
    const userNode = and.find((x) => typeof x['userId'] === 'string');
    expect(userNode?.['userId']).toBe('u1');
  });

  it('list: search 模糊匹配 title', async () => {
    prisma.task.findMany.mockResolvedValueOnce([]);
    await service.list(makeDto({ search: 'thesis', limit: 20 }));

    const arg0 = prisma.task.findMany.mock.calls[0]?.[0];
    const where = asRecord(asRecord(arg0).where);
    const and = asArray(where['AND']).map(asRecord);
    const orNode = and.find((x) => x['OR'] !== undefined);
    const or = asArray(orNode ? orNode['OR'] : undefined).map(asRecord);
    const titleNode = or.find((x) => x['title'] !== undefined);
    const title = asRecord(titleNode ? titleNode['title'] : undefined);
    expect(title['contains']).toBe('thesis');
  });

  it('list: linkedOnly 与 unlinkedOnly 互斥（抛错）', async () => {
    await expect(
      service.list(makeDto({ linkedOnly: true, unlinkedOnly: true })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('list: isLinked 计算正确（绑定的 task 返回 true）', async () => {
    prisma.task.findMany.mockResolvedValueOnce([
      {
        id: 't1',
        title: 'A',
        educationLevel: 'MASTER',
        status: 'INIT',
        currentStage: 'OUTLINE',
        deadline: null,
        userId: 'u1',
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-02T00:00:00.000Z'),
        order: { id: 'o1' },
      },
    ]);

    const res = await service.list(makeDto({ limit: 20 }));
    expect(res.items[0].isLinked).toBe(true);
    expect(res.items[0].linkedOrderId).toBe('o1');
  });

  it('list: page 模式返回 total/page/pageSize，且支持 sortBy/sortOrder', async () => {
    prisma.task.count.mockResolvedValueOnce(1);
    prisma.task.findMany.mockResolvedValueOnce([
      {
        id: 't1',
        title: 'A',
        educationLevel: 'MASTER',
        status: 'INIT',
        currentStage: 'OUTLINE',
        deadline: null,
        userId: 'u1',
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-02T00:00:00.000Z'),
        order: null,
      },
    ]);

    const res = await service.list(
      makeDto({ page: 1, pageSize: 20, sortBy: 'updatedAt', sortOrder: 'asc' }),
    );
    expect(res.total).toBe(1);
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(20);
    expect(res.nextCursor).toBeNull();

    const arg0 = prisma.task.findMany.mock.calls[0]?.[0];
    const orderBy = asRecord(asRecord(arg0).orderBy);
    expect(orderBy.updatedAt).toBe('asc');
  });

  it('assign: 更新 assigneeId 并写入审计', async () => {
    prisma.task.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: 'INIT',
      assigneeId: null,
      completedAt: null,
    });
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u2', role: 'ADMIN' });
    prisma.task.update.mockResolvedValueOnce({ id: 't1' });
    prisma.taskAdminLog.create.mockResolvedValueOnce({ id: 'log1' });
    jest.spyOn(service, 'detail').mockResolvedValueOnce(makeMockDetail());

    await service.assign('t1', 'u2', 'op1');

    const updateArg = asRecord(prisma.task.update.mock.calls[0]?.[0]);
    const updateData = asRecord(updateArg['data']);
    expect(updateData['assigneeId']).toBe('u2');
    const logArg = asRecord(prisma.taskAdminLog.create.mock.calls[0]?.[0]);
    const logData = asRecord(logArg['data']);
    expect(logData['action']).toBe('ASSIGN');
    expect(logData['operatorId']).toBe('op1');
    expect(logData['assigneeId']).toBe('u2');
  });

  it('unassign: 清空 assigneeId 并写入审计', async () => {
    prisma.task.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: 'INIT',
      assigneeId: 'u2',
      completedAt: null,
    });
    prisma.task.update.mockResolvedValueOnce({ id: 't1' });
    prisma.taskAdminLog.create.mockResolvedValueOnce({ id: 'log1' });
    jest.spyOn(service, 'detail').mockResolvedValueOnce(makeMockDetail());

    await service.unassign('t1', 'op1');

    const updateArg = asRecord(prisma.task.update.mock.calls[0]?.[0]);
    const updateData = asRecord(updateArg['data']);
    expect(updateData['assigneeId']).toBeNull();
    const logArg = asRecord(prisma.taskAdminLog.create.mock.calls[0]?.[0]);
    const logData = asRecord(logArg['data']);
    expect(logData['action']).toBe('UNASSIGN');
    expect(logData['operatorId']).toBe('op1');
    expect(logData['assigneeId']).toBe('u2');
  });

  it('overrideStatus: DONE → completedAt 置为 now（若原为空）并写入审计', async () => {
    prisma.task.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: 'INIT',
      assigneeId: null,
      completedAt: null,
    });
    prisma.task.update.mockResolvedValueOnce({ id: 't1' });
    prisma.taskAdminLog.create.mockResolvedValueOnce({ id: 'log1' });
    jest.spyOn(service, 'detail').mockResolvedValueOnce(makeMockDetail());

    await service.overrideStatus('t1', 'DONE', 'manual', 'op1');

    const updateArg = asRecord(prisma.task.update.mock.calls[0]?.[0]);
    const updateData = asRecord(updateArg['data']);
    expect(updateData['status']).toBe('DONE');
    expect(updateData['completedAt']).toBeInstanceOf(Date);
    const logArg = asRecord(prisma.taskAdminLog.create.mock.calls[0]?.[0]);
    const logData = asRecord(logArg['data']);
    expect(logData['action']).toBe('OVERRIDE_STATUS');
    expect(logData['fromStatus']).toBe('INIT');
    expect(logData['toStatus']).toBe('DONE');
    expect(logData['reason']).toBe('manual');
  });

  it('addAdminNote: 写入审计（内容）', async () => {
    prisma.task.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: 'INIT',
      assigneeId: null,
      completedAt: null,
    });
    prisma.taskAdminLog.create.mockResolvedValueOnce({ id: 'log1' });
    jest.spyOn(service, 'detail').mockResolvedValueOnce(makeMockDetail());

    await service.addAdminNote('t1', 'note', 'op1');

    const logArg = asRecord(prisma.taskAdminLog.create.mock.calls[0]?.[0]);
    const logData = asRecord(logArg['data']);
    expect(logData['action']).toBe('ADD_NOTE');
    expect(logData['operatorId']).toBe('op1');
    expect(logData['content']).toBe('note');
  });

  it('batchAssign: 超过 200 条直接拒绝', async () => {
    const ids = Array.from({ length: 201 }).map((_, i) => `t${i}`);
    await expect(service.batchAssign(ids, 'u2', 'op1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('batchAssign: 任意任务不存在 → 直接失败且不进入事务', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u2', role: 'ADMIN' });
    prisma.task.findMany.mockResolvedValueOnce([
      { id: 't1', assigneeId: null },
    ]);

    await expect(
      service.batchAssign(['t1', 't_missing'], 'u2', 'op1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('batchOverrideStatus: 任意任务不存在 → 直接失败且不进入事务', async () => {
    prisma.task.findMany.mockResolvedValueOnce([
      { id: 't1', status: 'INIT', completedAt: null },
    ]);

    await expect(
      service.batchOverrideStatus(['t1', 't_missing'], 'DONE', 'reason', 'op1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('batchUnlinkOrders: 任意任务不存在 → 直接失败且不进入事务', async () => {
    prisma.task.findMany.mockResolvedValueOnce([{ id: 't1' }]);
    await expect(
      service.batchUnlinkOrders(['t1', 't_missing'], 'op1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('batchUnlinkOrders: 有关联订单时写入更新与审计，affectedOrders 为订单数', async () => {
    prisma.task.findMany.mockResolvedValueOnce([{ id: 't1' }, { id: 't2' }]);
    prisma.order.findMany.mockResolvedValueOnce([
      { id: 'o1', taskId: 't1' },
      { id: 'o2', taskId: 't1' },
    ]);
    prisma.order.update.mockResolvedValue({ id: 'o1' });
    prisma.taskAdminLog.create.mockResolvedValue({ id: 'log1' });

    const res = await service.batchUnlinkOrders(['t1', 't2'], 'op1');
    expect(res.affectedOrders).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('exportCsv: total<=5000 → 返回 content，且不包含 admin 备注字段', async () => {
    prisma.task.count.mockResolvedValueOnce(2);
    prisma.task.findMany.mockResolvedValueOnce([
      {
        id: 't1',
        title: 'A',
        educationLevel: 'MASTER',
        status: 'INIT',
        currentStage: 'TOPIC',
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-02T00:00:00.000Z'),
        assignee: { id: 'u1', nickname: 'N1', email: 'e1@example.com' },
        order: { id: 'o1' },
      },
      {
        id: 't2',
        title: 'B',
        educationLevel: 'PHD',
        status: 'DONE',
        currentStage: 'WRITING',
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-02T00:00:00.000Z'),
        assignee: null,
        order: null,
      },
    ]);

    const res = await service.exportCsv(
      makeDto({ sortBy: 'createdAt', sortOrder: 'desc' }),
    );
    expect(res.stream).toBeUndefined();
    expect(res.content).toContain(
      '任务ID,标题,学历,状态,阶段,创建时间,更新时间,处理人,关联订单数',
    );
    expect(res.content).not.toContain('备注');
    expect(res.content?.split('\n').filter(Boolean).length).toBe(3);
  });

  it('exportCsv: total>5000 → 返回 stream', async () => {
    prisma.task.count.mockResolvedValueOnce(6000);
    prisma.task.findMany.mockResolvedValueOnce([
      {
        id: 't1',
        title: 'A',
        educationLevel: 'MASTER',
        status: 'INIT',
        currentStage: 'TOPIC',
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-02T00:00:00.000Z'),
        assignee: null,
        order: null,
      },
    ]);

    const res = await service.exportCsv(
      makeDto({ sortBy: 'updatedAt', sortOrder: 'asc' }),
    );
    expect(res.content).toBeUndefined();
    expect(res.stream).toBeDefined();
    const s = await collectStream(res.stream!);
    expect(s).toContain(
      '任务ID,标题,学历,状态,阶段,创建时间,更新时间,处理人,关联订单数',
    );
    expect(s.split('\n').filter(Boolean).length).toBe(2);
  });
});
