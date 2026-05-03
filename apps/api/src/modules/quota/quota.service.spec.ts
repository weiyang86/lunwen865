import { BadRequestException } from '@nestjs/common';
import { QuotaChangeReason, QuotaType } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { QuotaService } from './quota.service';

type UserQuotaRow = {
  userId: string;
  quotaType: QuotaType;
  balance: number;
  totalIn: number;
  totalOut: number;
};

type QuotaLogRow = {
  id: string;
  userId: string;
  quotaType: QuotaType;
  change: number;
  balanceAfter: number;
  reason: QuotaChangeReason;
  orderId: string | null;
  bizId: string | null;
  remark: string | null;
  createdAt: Date;
};

type UserQuotaSelect = Partial<Record<keyof UserQuotaRow, boolean>>;

type UserQuotaFindUniqueArgs = {
  where: { userId_quotaType: { userId: string; quotaType: QuotaType } };
  select?: UserQuotaSelect;
};

type UserQuotaFindManyArgs = {
  where: { userId: string };
  select?: UserQuotaSelect;
};

type UserQuotaUpsertArgs = {
  where: { userId_quotaType: { userId: string; quotaType: QuotaType } };
  create: {
    userId: string;
    quotaType: QuotaType;
    balance: number;
    totalIn?: number;
    totalOut?: number;
  };
  update: {
    balance?: { increment?: number; decrement?: number };
    totalIn?: { increment?: number };
    totalOut?: { increment?: number };
  };
  select?: { balance?: boolean };
};

type UserQuotaUpdateManyArgs = {
  where: { userId: string; quotaType: QuotaType; balance?: { gte: number } };
  data: {
    balance?: { decrement: number };
    totalOut?: { increment: number };
  };
};

type QuotaLogFindFirstArgs = {
  where: {
    userId: string;
    quotaType: QuotaType;
    reason: QuotaChangeReason;
    bizId: string;
  };
  select?: { id?: boolean };
};

type QuotaLogCreateArgs = {
  data: {
    userId: string;
    quotaType: QuotaType;
    change: number;
    balanceAfter: number;
    reason: QuotaChangeReason;
    orderId?: string | null;
    bizId?: string | null;
    remark?: string | null;
  };
  select?: { id?: boolean };
};

type TxClient = {
  userQuota: {
    findUnique: (
      args: UserQuotaFindUniqueArgs,
    ) => Promise<Partial<UserQuotaRow> | UserQuotaRow | null>;
    findMany: (
      args: UserQuotaFindManyArgs,
    ) => Promise<Array<Partial<UserQuotaRow> | UserQuotaRow>>;
    upsert: (
      args: UserQuotaUpsertArgs,
    ) => Promise<{ balance: number } | UserQuotaRow>;
    updateMany: (args: UserQuotaUpdateManyArgs) => Promise<{ count: number }>;
  };
  quotaLog: {
    findFirst: (args: QuotaLogFindFirstArgs) => Promise<{ id: string } | null>;
    create: (args: QuotaLogCreateArgs) => Promise<{ id: string } | QuotaLogRow>;
    findMany: () => Promise<QuotaLogRow[]>;
    count: () => Promise<number>;
  };
  $transaction: <T>(fn: (tx: TxClient) => Promise<T>) => Promise<T>;
};

function buildKey(userId: string, quotaType: QuotaType): string {
  return `${userId}:${quotaType}`;
}

function pickUserQuota(row: UserQuotaRow, select?: UserQuotaSelect) {
  if (!select) return row;
  const out: Partial<UserQuotaRow> = {};
  for (const key of Object.keys(select) as Array<keyof UserQuotaRow>) {
    if (select[key]) {
      (out as Record<string, unknown>)[key] = row[key];
    }
  }
  return out;
}

describe('QuotaService', () => {
  let service: QuotaService;
  let store: Map<string, UserQuotaRow>;
  let logs: QuotaLogRow[];

  beforeEach(() => {
    store = new Map();
    logs = [];

    const prismaMock: TxClient = {
      userQuota: {
        findUnique: (args) => {
          const k = buildKey(
            args.where.userId_quotaType.userId,
            args.where.userId_quotaType.quotaType,
          );
          const row = store.get(k);
          if (!row) return Promise.resolve(null);
          return Promise.resolve(pickUserQuota(row, args.select));
        },
        findMany: (args) => {
          const out = [...store.values()].filter(
            (x) => x.userId === args.where.userId,
          );
          return Promise.resolve(
            out.map((row) => pickUserQuota(row, args.select)),
          );
        },
        upsert: (args) => {
          const userId = args.where.userId_quotaType.userId;
          const quotaType = args.where.userId_quotaType.quotaType;
          const k = buildKey(userId, quotaType);
          const existing = store.get(k);

          if (!existing) {
            const created: UserQuotaRow = {
              userId,
              quotaType,
              balance: args.create.balance,
              totalIn: args.create.totalIn ?? 0,
              totalOut: args.create.totalOut ?? 0,
            };
            store.set(k, created);
            return Promise.resolve(
              args.select ? { balance: created.balance } : created,
            );
          }

          const inc = args.update.balance?.increment ?? 0;
          const dec = args.update.balance?.decrement ?? 0;
          const inInc = args.update.totalIn?.increment ?? 0;
          const outInc = args.update.totalOut?.increment ?? 0;
          const updated: UserQuotaRow = {
            ...existing,
            balance: existing.balance + inc - dec,
            totalIn: existing.totalIn + inInc,
            totalOut: existing.totalOut + outInc,
          };
          store.set(k, updated);
          return Promise.resolve(
            args.select ? { balance: updated.balance } : updated,
          );
        },
        updateMany: (args) => {
          const gte = args.where.balance?.gte ?? 0;
          const k = buildKey(args.where.userId, args.where.quotaType);
          const existing = store.get(k);
          if (!existing) return Promise.resolve({ count: 0 });
          if (existing.balance < gte) return Promise.resolve({ count: 0 });

          const dec = args.data.balance?.decrement ?? 0;
          const outInc = args.data.totalOut?.increment ?? 0;
          store.set(k, {
            ...existing,
            balance: existing.balance - dec,
            totalOut: existing.totalOut + outInc,
          });
          return Promise.resolve({ count: 1 });
        },
      },
      quotaLog: {
        findFirst: (args) => {
          const row = logs.find(
            (l) =>
              l.userId === args.where.userId &&
              l.quotaType === args.where.quotaType &&
              l.reason === args.where.reason &&
              l.bizId === args.where.bizId,
          );
          return Promise.resolve(row ? { id: row.id } : null);
        },
        create: (args) => {
          const id = `log_${logs.length + 1}`;
          const row: QuotaLogRow = {
            id,
            userId: args.data.userId,
            quotaType: args.data.quotaType,
            change: args.data.change,
            balanceAfter: args.data.balanceAfter,
            reason: args.data.reason,
            orderId: args.data.orderId ?? null,
            bizId: args.data.bizId ?? null,
            remark: args.data.remark ?? null,
            createdAt: new Date(),
          };
          logs.push(row);
          return Promise.resolve(args.select ? { id } : row);
        },
        findMany: () => Promise.resolve(logs),
        count: () => Promise.resolve(logs.length),
      },
      $transaction: (fn) => fn(prismaMock),
    };

    service = new QuotaService(prismaMock as unknown as PrismaService);
  });

  it('grant 成功：余额增加 + 流水正确', async () => {
    await service.grant({
      userId: 'u1',
      type: QuotaType.EXPORT,
      amount: 3,
      reason: QuotaChangeReason.PURCHASE,
    });

    const bal = await service.getBalance('u1', QuotaType.EXPORT);
    expect(bal).toBe(3);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.change).toBe(3);
    expect(logs[0]?.balanceAfter).toBe(3);
    expect(logs[0]?.reason).toBe(QuotaChangeReason.PURCHASE);
  });

  it('grant 数量 ≤ 0 → BadRequestException', async () => {
    await expect(
      service.grant({
        userId: 'u1',
        type: QuotaType.EXPORT,
        amount: 0,
        reason: QuotaChangeReason.PURCHASE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('consume 余额不足 → BadRequestException 含中文', async () => {
    await expect(
      service.consume({
        userId: 'u1',
        type: QuotaType.EXPORT,
        amount: 1,
      }),
    ).rejects.toThrow(/配额不足/);
  });

  it('consume 成功：余额减少 + 流水 change 为负数 + balanceAfter 准确', async () => {
    await service.grant({
      userId: 'u1',
      type: QuotaType.EXPORT,
      amount: 2,
      reason: QuotaChangeReason.PURCHASE,
    });

    await service.consume({
      userId: 'u1',
      type: QuotaType.EXPORT,
      amount: 1,
      bizId: 'biz1',
    });

    const bal = await service.getBalance('u1', QuotaType.EXPORT);
    expect(bal).toBe(1);
    const last = logs[logs.length - 1];
    expect(last?.change).toBe(-1);
    expect(last?.balanceAfter).toBe(1);
    expect(last?.reason).toBe(QuotaChangeReason.CONSUME);
    expect(last?.bizId).toBe('biz1');
  });

  it('并发 consume：初始余额 5 → 成功 5 个、失败 5 个，最终余额 0', async () => {
    await service.grant({
      userId: 'u1',
      type: QuotaType.PAPER_GENERATION,
      amount: 5,
      reason: QuotaChangeReason.PURCHASE,
    });

    const results = await Promise.allSettled(
      new Array(10).fill(0).map((_, idx) =>
        service.consume({
          userId: 'u1',
          type: QuotaType.PAPER_GENERATION,
          amount: 1,
          bizId: `biz_${idx}`,
        }),
      ),
    );

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.filter((r) => r.status === 'rejected').length;
    expect(ok).toBe(5);
    expect(fail).toBe(5);
    expect(await service.getBalance('u1', QuotaType.PAPER_GENERATION)).toBe(0);
  });

  it('ensure 余额够 → 不抛', async () => {
    await service.grant({
      userId: 'u1',
      type: QuotaType.POLISH,
      amount: 1,
      reason: QuotaChangeReason.PURCHASE,
    });
    await expect(
      service.ensure('u1', QuotaType.POLISH, 1),
    ).resolves.toBeUndefined();
  });

  it('ensure 余额不够 → 抛 BadRequestException', async () => {
    await expect(
      service.ensure('u1', QuotaType.EXPORT, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refund：余额回滚成功，流水 reason=REFUND', async () => {
    await service.refund({
      userId: 'u1',
      type: QuotaType.EXPORT,
      amount: 2,
      orderId: 'o1',
    });
    expect(await service.getBalance('u1', QuotaType.EXPORT)).toBe(-2);
    const last = logs[logs.length - 1];
    expect(last?.reason).toBe(QuotaChangeReason.REFUND);
    expect(last?.orderId).toBe('o1');
    expect(last?.change).toBe(-2);
    expect(last?.balanceAfter).toBe(-2);
  });
});
