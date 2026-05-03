import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PolishStatus } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UserService } from '../user/user.service';
import type { QuotaService } from '../quota/quota.service';
import { PolishQueue } from './polish.queue';
import { PolishService } from './polish.service';

describe('PolishService', () => {
  type PrismaMock = {
    polishTask: {
      create: (args: unknown) => Promise<unknown>;
      findMany: (args: unknown) => Promise<unknown[]>;
      count: (args: unknown) => Promise<number>;
      findUnique: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
      delete: (args: unknown) => Promise<unknown>;
      aggregate: (args: unknown) => Promise<unknown>;
      groupBy: (args: unknown) => Promise<unknown[]>;
    };
    polishSegment: {
      deleteMany: (args: unknown) => Promise<unknown>;
      updateMany: (args: unknown) => Promise<unknown>;
      findMany: (args: unknown) => Promise<unknown[]>;
    };
    $transaction: (arg: unknown) => Promise<unknown>;
  };

  let prisma: DeepMockProxy<PrismaMock>;
  let userService: DeepMockProxy<UserService>;
  let queue: DeepMockProxy<PolishQueue>;
  let quotaService: DeepMockProxy<QuotaService>;
  let service: PolishService;

  beforeEach(() => {
    prisma = mockDeep<PrismaMock>();
    userService = mockDeep<UserService>();
    queue = mockDeep<PolishQueue>();
    quotaService = mockDeep<QuotaService>();
    quotaService.ensure.mockResolvedValue(undefined);

    prisma.$transaction.mockImplementation(async (ops) => {
      return Promise.all(ops as Promise<unknown>[]);
    });

    service = new PolishService(
      prisma as unknown as PrismaService,
      userService,
      queue,
      quotaService,
    );
  });

  it('创建任务成功', async () => {
    userService.checkQuota.mockResolvedValueOnce(true);
    prisma.polishTask.create.mockResolvedValueOnce({ id: 'p1' });

    const created = await service.create('u1', {
      text: 'a'.repeat(200),
      strength: 'LIGHT',
      mode: 'BALANCED',
    } as never);

    expect(created).toEqual(expect.objectContaining({ id: 'p1' }));
    expect(queue.enqueue.mock.calls).toHaveLength(1);
  });

  it('配额不足拒绝创建', async () => {
    userService.checkQuota.mockResolvedValueOnce(false);

    await expect(
      service.create('u1', {
        text: 'a'.repeat(200),
        strength: 'LIGHT',
        mode: 'BALANCED',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('文本过短拒绝', async () => {
    await expect(
      service.create('u1', {
        text: 'a'.repeat(10),
        strength: 'LIGHT',
        mode: 'BALANCED',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('文本过长拒绝', async () => {
    await expect(
      service.create('u1', {
        text: 'a'.repeat(20001),
        strength: 'LIGHT',
        mode: 'BALANCED',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('列表分页', async () => {
    prisma.polishTask.count.mockResolvedValueOnce(2);
    prisma.polishTask.findMany.mockResolvedValueOnce([
      { id: 'p1' },
      { id: 'p2' },
    ]);

    const res = await service.findAll('u1', { page: 1, pageSize: 10 });
    expect(res.total).toBe(2);
    expect(res.data).toHaveLength(2);
  });

  it('findAll 分页参数正确（page=2 pageSize=10）', async () => {
    prisma.polishTask.count.mockResolvedValueOnce(30);
    prisma.polishTask.findMany.mockResolvedValueOnce(
      Array.from({ length: 10 }).map((_, i) => ({ id: `p${i + 11}` })),
    );

    const res = await service.findAll('u1', { page: 2, pageSize: 10 });
    expect(res.data).toHaveLength(10);

    const args = prisma.polishTask.findMany.mock.calls[0]?.[0] as {
      skip?: number;
      take?: number;
    };
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
  });

  it('取消已完成任务应失败', async () => {
    prisma.polishTask.findUnique.mockResolvedValueOnce({
      id: 'p1',
      userId: 'u1',
      status: PolishStatus.SUCCESS,
    });

    await expect(service.cancel('u1', 'p1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('重试非 FAILED 任务应失败', async () => {
    prisma.polishTask.findUnique.mockResolvedValueOnce({
      id: 'p1',
      userId: 'u1',
      status: PolishStatus.PROCESSING,
      originalText: 'x',
    });

    await expect(service.retry('u1', 'p1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('跨用户访问别人任务返回 403', async () => {
    prisma.polishTask.findUnique.mockResolvedValueOnce({
      id: 'p1',
      userId: 'u2',
      segments: [],
    });

    await expect(service.findOne('u1', 'p1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('删除非终态任务应失败', async () => {
    prisma.polishTask.findUnique.mockResolvedValueOnce({
      id: 'p1',
      userId: 'u1',
      status: PolishStatus.PROCESSING,
    });

    await expect(service.delete('u1', 'p1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('删除终态任务成功', async () => {
    prisma.polishTask.findUnique.mockResolvedValueOnce({
      id: 'p1',
      userId: 'u1',
      status: PolishStatus.FAILED,
    });
    prisma.polishTask.delete.mockResolvedValueOnce({ id: 'p1' });

    await expect(service.delete('u1', 'p1')).resolves.toBeUndefined();
  });

  it('findOne: not found', async () => {
    prisma.polishTask.findUnique.mockResolvedValueOnce(null);
    await expect(service.findOne('u1', 'p1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getDiff: 非 SUCCESS 状态应失败', async () => {
    prisma.polishTask.findUnique.mockResolvedValueOnce({
      id: 'p1',
      userId: 'u1',
      status: PolishStatus.PROCESSING,
      aiScoreBefore: null,
      aiScoreAfter: null,
    });
    await expect(service.getDiff('u1', 'p1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('getStats 聚合正确', async () => {
    prisma.polishTask.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);

    prisma.polishTask.aggregate
      .mockResolvedValueOnce({
        _sum: { wordsCharged: 1200 },
        _avg: { aiScoreBefore: 60, aiScoreAfter: 45 },
      })
      .mockResolvedValueOnce({ _sum: { wordsCharged: 300 } });

    prisma.polishTask.groupBy.mockResolvedValueOnce([
      { strength: 'LIGHT', _count: { _all: 2 } },
      { strength: 'MEDIUM', _count: { _all: 3 } },
    ]);

    const stats = await service.getStats('u1');
    expect(stats.totalTasks).toBe(5);
    expect(stats.successTasks).toBe(3);
    expect(stats.failedTasks).toBe(2);
    expect(stats.totalWordsProcessed).toBe(1200);
    expect(stats.totalWordsThisMonth).toBe(300);
    expect(stats.avgAiScoreReduction).toBe(15);
    expect(stats.byStrength).toEqual(
      expect.objectContaining({ LIGHT: 2, MEDIUM: 3 }),
    );
  });
});
