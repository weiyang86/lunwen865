import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../prisma/prisma.service';
import { ListOrdersDto } from './dto/list-orders.dto';
import { OrdersService } from './orders.service';

type PrismaMock = {
  order: {
    findMany: (args: unknown) => Promise<unknown[]>;
    count: (args: unknown) => Promise<number>;
    findUnique: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  user: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
  task: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
  taskAdminLog: {
    create: (args: unknown) => Promise<unknown>;
  };
  $transaction: (args: Promise<unknown>[]) => Promise<unknown[]>;
};

describe('OrdersService (admin)', () => {
  let prisma: DeepMockProxy<PrismaMock>;
  let service: OrdersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaMock>();
    prisma.$transaction.mockImplementation(async (args) => Promise.all(args));
    service = new OrdersService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeListDto(patch: Partial<ListOrdersDto> = {}) {
    const dto = new ListOrdersDto();
    Object.assign(dto, patch);
    return dto;
  }

  it('list: taskId=null → thesis/currentStage/dueDate/taskId 均为 null', async () => {
    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: 'o1',
        orderNo: 'NO_1',
        status: 'PAID',
        amountCents: 100,
        paidAmountCents: 100,
        discountCents: 0,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        paidAt: null,
        user: { id: 'u1', phone: null, nickname: null },
        _count: { items: 1 },
        task: null,
      },
    ]);
    prisma.order.count.mockResolvedValueOnce(1);

    const res = await service.list(
      makeListDto({ page: 1, pageSize: 20, status: 'ALL' }),
    );
    expect(res.items).toHaveLength(1);
    expect(res.items[0].thesis).toBeNull();
    expect(res.items[0].currentStage).toBeNull();
    expect(res.items[0].dueDate).toBeNull();
    expect(res.items[0].taskId).toBeNull();
  });

  it('list: task 存在 → 填充 thesis/currentStage/dueDate/taskId', async () => {
    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: 'o1',
        orderNo: 'NO_1',
        status: 'PAID',
        amountCents: 100,
        paidAmountCents: 100,
        discountCents: 0,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        paidAt: null,
        user: { id: 'u1', phone: null, nickname: null },
        _count: { items: 1 },
        task: {
          id: 't1',
          title: '论文题目',
          educationLevel: 'MASTER',
          currentStage: 'OUTLINE',
          deadline: new Date('2026-06-30T00:00:00.000Z'),
        },
      },
    ]);
    prisma.order.count.mockResolvedValueOnce(1);

    const res = await service.list(
      makeListDto({ page: 1, pageSize: 20, status: 'ALL' }),
    );
    expect(res.items[0].taskId).toBe('t1');
    expect(res.items[0].currentStage).toBe('OUTLINE');
    expect(res.items[0].dueDate).toBe('2026-06-30T00:00:00.000Z');
    expect(res.items[0].thesis).toEqual({
      title: '论文题目',
      educationLevel: 'MASTER',
    });
  });

  it('list: currentStage 过滤 → where.task.currentStage 生效（未关联订单自动被过滤）', async () => {
    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.order.count.mockResolvedValueOnce(0);

    await service.list(makeListDto({ status: 'ALL', currentStage: 'OUTLINE' }));

    const argUnknown = prisma.order.findMany.mock.calls[0]?.[0];
    const arg = argUnknown as {
      where?: { task?: { currentStage?: string } };
    };
    expect(arg.where?.task?.currentStage).toBe('OUTLINE');
  });

  it('list: dueDateBefore 过滤 → where.task.deadline.lte 生效（未关联订单自动被过滤）', async () => {
    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.order.count.mockResolvedValueOnce(0);

    await service.list(
      makeListDto({ status: 'ALL', dueDateBefore: '2026-06-01' }),
    );

    const argUnknown = prisma.order.findMany.mock.calls[0]?.[0];
    const arg = argUnknown as {
      where?: { task?: { deadline?: { lte?: Date } } };
    };
    expect(arg.where?.task?.deadline?.lte).toBeInstanceOf(Date);
  });

  it('detail: taskId=null → 新增字段为 null', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'o1',
      orderNo: 'NO_1',
      status: 'PAID',
      amountCents: 100,
      paidAmountCents: 100,
      discountCents: 0,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      user: { id: 'u1', phone: null, nickname: null, avatar: null },
      items: [],
      refunds: [],
      task: null,
    });

    const res = await service.detail('o1');
    expect(res.thesis).toBeNull();
    expect(res.currentStage).toBeNull();
    expect(res.dueDate).toBeNull();
    expect(res.primaryTutorId).toBeNull();
    expect(res.taskId).toBeNull();
  });

  it('list: primaryTutorId 过滤 → where.primaryTutorId 生效', async () => {
    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.order.count.mockResolvedValueOnce(0);

    await service.list(makeListDto({ status: 'ALL', primaryTutorId: 't1' }));

    const argUnknown = prisma.order.findMany.mock.calls[0]?.[0];
    const arg = argUnknown as { where?: { primaryTutorId?: string } };
    expect(arg.where?.primaryTutorId).toBe('t1');
  });

  it('assignTutor: 用户不是导师 → 400', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({ id: 'o1' });
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', role: 'USER' });

    await expect(service.assignTutor('o1', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('assignTutor: 成功', async () => {
    prisma.order.findUnique
      .mockResolvedValueOnce({ id: 'o1' })
      .mockResolvedValueOnce({
        id: 'o1',
        orderNo: 'NO_1',
        status: 'PAID',
        amountCents: 100,
        paidAmountCents: 100,
        discountCents: 0,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
        user: { id: 'u1', phone: null, nickname: null, avatar: null },
        primaryTutorId: 't1',
        primaryTutor: { id: 't1', nickname: '导师A', email: 't1@example.com' },
        items: [],
        refunds: [],
        task: null,
      });
    prisma.user.findUnique.mockResolvedValueOnce({ id: 't1', role: 'TUTOR' });
    prisma.order.update.mockResolvedValueOnce({ id: 'o1' });

    const res = await service.assignTutor('o1', 't1');
    expect(res.primaryTutorId).toBe('t1');
    expect(res.primaryTutor?.id).toBe('t1');
  });

  it('unassignTutor: 成功', async () => {
    prisma.order.findUnique
      .mockResolvedValueOnce({ id: 'o1' })
      .mockResolvedValueOnce({
        id: 'o1',
        orderNo: 'NO_1',
        status: 'PAID',
        amountCents: 100,
        paidAmountCents: 100,
        discountCents: 0,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
        user: { id: 'u1', phone: null, nickname: null, avatar: null },
        primaryTutorId: null,
        primaryTutor: null,
        items: [],
        refunds: [],
        task: null,
      });
    prisma.order.update.mockResolvedValueOnce({ id: 'o1' });

    const res = await service.unassignTutor('o1');
    expect(res.primaryTutorId).toBeNull();
    expect(res.primaryTutor).toBeNull();
  });

  it('linkTask: 跨用户绑定拒绝', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'o1',
      userId: 'u1',
      taskId: null,
    });
    prisma.task.findUnique.mockResolvedValueOnce({ id: 't1', userId: 'u2' });

    await expect(service.linkTask('o1', 't1', 'admin1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('linkTask: 订单已有 taskId 时拒绝覆盖', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'o1',
      userId: 'u1',
      taskId: 't_old',
    });

    await expect(
      service.linkTask('o1', 't_new', 'admin1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('linkTask: 任务已被其他订单绑定拒绝', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'o1',
      userId: 'u1',
      taskId: null,
    });
    prisma.task.findUnique.mockResolvedValueOnce({ id: 't1', userId: 'u1' });
    prisma.order.findFirst.mockResolvedValueOnce({ id: 'o_other' });

    await expect(service.linkTask('o1', 't1', 'admin1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('linkTask: 成功', async () => {
    prisma.order.findUnique
      .mockResolvedValueOnce({ id: 'o1', userId: 'u1', taskId: null })
      .mockResolvedValueOnce({
        id: 'o1',
        orderNo: 'NO_1',
        status: 'PAID',
        amountCents: 100,
        paidAmountCents: 100,
        discountCents: 0,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
        user: { id: 'u1', phone: null, nickname: null, avatar: null },
        items: [],
        refunds: [],
        task: {
          id: 't1',
          userId: 'u1',
          status: 'INIT',
          title: '论文题目',
          educationLevel: 'MASTER',
          currentStage: 'OUTLINE',
          requirements: null,
          totalWordCount: null,
          deadline: new Date('2026-06-30T00:00:00.000Z'),
          completedAt: null,
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
        },
      });
    prisma.task.findUnique.mockResolvedValueOnce({ id: 't1', userId: 'u1' });
    prisma.order.findFirst.mockResolvedValueOnce(null);
    prisma.order.update.mockResolvedValueOnce({ id: 'o1' });
    prisma.taskAdminLog.create.mockResolvedValueOnce({ id: 'log1' });

    const res = await service.linkTask('o1', 't1', 'admin1');
    expect(res.taskId).toBe('t1');
    expect(res.thesis?.title).toBe('论文题目');
  });

  it('unlinkTask: 成功且幂等', async () => {
    prisma.order.findUnique
      .mockResolvedValueOnce({ id: 'o1', taskId: null })
      .mockResolvedValueOnce({
        id: 'o1',
        orderNo: 'NO_1',
        status: 'PAID',
        amountCents: 100,
        paidAmountCents: 100,
        discountCents: 0,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
        user: { id: 'u1', phone: null, nickname: null, avatar: null },
        items: [],
        refunds: [],
        task: null,
      });
    prisma.order.update.mockResolvedValueOnce({ id: 'o1' });

    const res = await service.unlinkTask('o1', 'admin1');
    expect(res.taskId).toBeNull();
    expect(res.thesis).toBeNull();
  });

  it('linkTask: 订单不存在 → 404', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.linkTask('o_missing', 't1', 'admin1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
