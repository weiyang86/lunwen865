import { BadRequestException } from '@nestjs/common';
import { PaymentChannel, PaymentMethod } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { OrderService } from '../order/order.service';
import type { QuotaService } from '../quota/quota.service';
import { PaymentService } from './payment.service';
import type { AlipayProvider } from './providers/alipay.provider';
import type { WechatPayProvider } from './providers/wechat-pay.provider';

type OrderRow = {
  id: string;
  orderNo: string;
  userId: string;
  productId: string;
  productSnapshot: Record<string, unknown>;
  amountCents: number;
  paidAmountCents: number | null;
  status: string;
  channel: PaymentChannel | null;
  method: PaymentMethod | null;
  outTradeNo: string | null;
  transactionId: string | null;
  refundedAt: Date | null;
};

type RefundRow = {
  id: string;
  orderId: string;
  amountCents: number;
  status: string;
  errorMessage?: string | null;
  finishedAt: Date | null;
};

type UserQuotaRow = {
  id: string;
  userId: string;
  quotaType: string;
  balance: number;
  totalOut: number;
};

describe('RefundService(PaymentService.createRefund)', () => {
  let service: PaymentService;
  let prisma: PrismaService;
  let wechatRefund: jest.Mock;
  const orders = new Map<string, OrderRow>();
  const refunds = new Map<string, RefundRow>();
  const quotas = new Map<string, UserQuotaRow>();

  const key = (userId: string, quotaType: string) => `${userId}:${quotaType}`;

  beforeEach(() => {
    orders.clear();
    refunds.clear();
    quotas.clear();

    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn((k: string, def?: unknown) =>
        k === 'payment.sandbox' ? true : def,
      ),
    };
    wechatRefund = jest.fn(({ outRefundNo }: { outRefundNo: string }) =>
      Promise.resolve({ outRefundNo, refundId: 'WX_REF_1' }),
    );

    type TxClient = {
      order: {
        findUnique: (args: {
          where: { id: string };
          include?: { refunds?: boolean };
        }) => Promise<unknown>;
        update: (args: {
          where: { id: string };
          data: Partial<OrderRow>;
        }) => Promise<unknown>;
      };
      refund: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
        findUnique: (args: {
          where: { id: string };
          include?: { order?: boolean };
        }) => Promise<unknown>;
        update: (args: {
          where: { id: string };
          data: Partial<RefundRow>;
        }) => Promise<unknown>;
        aggregate: (args: {
          where: { orderId: string; status: string };
        }) => Promise<{ _sum: { amountCents: number } }>;
      };
      userQuota: {
        findUnique: (args: {
          where: { userId_quotaType: { userId: string; quotaType: string } };
        }) => Promise<UserQuotaRow | null>;
        update: (args: {
          where: { id: string };
          data: {
            balance: { decrement: number };
            totalOut: { increment: number };
          };
        }) => Promise<UserQuotaRow>;
      };
      quotaLog: {
        create: (args: unknown) => Promise<unknown>;
      };
      paymentLog: {
        create: (args: unknown) => Promise<unknown>;
      };
      $transaction: <T>(fn: (tx: TxClient) => Promise<T>) => Promise<T>;
    };

    const txClient = {} as TxClient;
    const prismaMock = {
      order: {
        findUnique: jest.fn(
          (args: {
            where: { id: string };
            include?: { refunds?: boolean };
          }) => {
            const o = orders.get(args.where.id);
            if (!o) return Promise.resolve(null);
            if (!args.include?.refunds) return Promise.resolve(o);
            return Promise.resolve({
              ...o,
              refunds: [...refunds.values()].filter((r) => r.orderId === o.id),
            });
          },
        ),
        update: jest.fn(
          (args: { where: { id: string }; data: Partial<OrderRow> }) => {
            const old = orders.get(args.where.id);
            if (!old) throw new Error('order not found');
            const next = { ...old, ...args.data };
            orders.set(old.id, next);
            return Promise.resolve(next);
          },
        ),
      },
      refund: {
        create: jest.fn((args: { data: Record<string, unknown> }) => {
          const id = `r_${refunds.size + 1}`;
          const row: RefundRow = {
            id,
            orderId: String(args.data.orderId),
            amountCents: Number(args.data.amountCents),
            status: String(args.data.status),
            finishedAt: null,
          };
          refunds.set(id, row);
          return Promise.resolve(row);
        }),
        findUnique: jest.fn(
          (args: { where: { id: string }; include?: { order?: boolean } }) => {
            const r = refunds.get(args.where.id);
            if (!r) return Promise.resolve(null);
            if (!args.include?.order) return Promise.resolve(r);
            return Promise.resolve({ ...r, order: orders.get(r.orderId) });
          },
        ),
        update: jest.fn(
          (args: { where: { id: string }; data: Partial<RefundRow> }) => {
            const old = refunds.get(args.where.id);
            if (!old) throw new Error('refund not found');
            const next = { ...old, ...args.data };
            refunds.set(old.id, next);
            return Promise.resolve(next);
          },
        ),
        aggregate: jest.fn(
          (args: { where: { orderId: string; status: string } }) => {
            const sum = [...refunds.values()]
              .filter(
                (r) =>
                  r.orderId === args.where.orderId &&
                  r.status === args.where.status,
              )
              .reduce((acc, cur) => acc + cur.amountCents, 0);
            return Promise.resolve({ _sum: { amountCents: sum } });
          },
        ),
      },
      userQuota: {
        findUnique: jest.fn(
          (args: {
            where: { userId_quotaType: { userId: string; quotaType: string } };
          }) =>
            Promise.resolve(
              quotas.get(
                key(
                  args.where.userId_quotaType.userId,
                  args.where.userId_quotaType.quotaType,
                ),
              ) ?? null,
            ),
        ),
        update: jest.fn(
          (args: {
            where: { id: string };
            data: {
              balance: { decrement: number };
              totalOut: { increment: number };
            };
          }) => {
            const row = [...quotas.values()].find(
              (x) => x.id === args.where.id,
            );
            if (!row) throw new Error('quota not found');
            const next: UserQuotaRow = {
              ...row,
              balance: row.balance - args.data.balance.decrement,
              totalOut: row.totalOut + args.data.totalOut.increment,
            };
            quotas.set(key(next.userId, next.quotaType), next);
            return Promise.resolve(next);
          },
        ),
      },
      quotaLog: {
        create: jest.fn(() => Promise.resolve({ id: 'ql_1' })),
      },
      paymentLog: {
        create: jest.fn(() => Promise.resolve({ id: 'pl_1' })),
      },
      $transaction: jest.fn(<T>(fn: (tx: TxClient) => Promise<T>) =>
        fn(txClient),
      ),
    };

    Object.assign(txClient, prismaMock as unknown as TxClient);
    prisma = prismaMock as unknown as PrismaService;
    service = new PaymentService(
      prisma,
      {} as OrderService,
      {} as QuotaService,
      config as ConfigService,
      {
        refund: wechatRefund,
      } as unknown as WechatPayProvider,
      {} as AlipayProvider,
    );
  });

  const seedPaidOrder = (amountCents = 1000) => {
    orders.set('o1', {
      id: 'o1',
      orderNo: 'PAY_1',
      userId: 'u1',
      productId: 'p1',
      productSnapshot: { paperQuota: 5, polishQuota: 20, exportQuota: 10 },
      amountCents,
      paidAmountCents: amountCents,
      status: 'PAID',
      channel: PaymentChannel.WECHAT,
      method: PaymentMethod.WECHAT_NATIVE,
      outTradeNo: 'PAY_1',
      transactionId: 'TX_1',
      refundedAt: null,
    });
  };

  it('订单非 PAID -> 400', async () => {
    seedPaidOrder();
    orders.set('o1', { ...orders.get('o1')!, status: 'PENDING' });
    await expect(
      service.createRefund({ operatorId: 'admin', orderId: 'o1', reason: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('退款金额为 0 -> 400', async () => {
    seedPaidOrder();
    await expect(
      service.createRefund({
        operatorId: 'admin',
        orderId: 'o1',
        amountCents: 0,
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('退款金额大于可退 -> 400', async () => {
    seedPaidOrder();
    refunds.set('r_done', {
      id: 'r_done',
      orderId: 'o1',
      amountCents: 600,
      status: 'SUCCESS',
      finishedAt: new Date(),
    });
    await expect(
      service.createRefund({
        operatorId: 'admin',
        orderId: 'o1',
        amountCents: 500,
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('部分退款成功：订单回 PAID，配额按比例回滚', async () => {
    seedPaidOrder(1000);
    quotas.set(key('u1', 'PAPER_GENERATION'), {
      id: 'q1',
      userId: 'u1',
      quotaType: 'PAPER_GENERATION',
      balance: 5,
      totalOut: 0,
    });
    await service.createRefund({
      operatorId: 'admin',
      orderId: 'o1',
      amountCents: 400,
      reason: '部分退',
    });
    expect(orders.get('o1')?.status).toBe('PAID');
    expect(quotas.get(key('u1', 'PAPER_GENERATION'))?.balance).toBe(3);
  });

  it('全额退款成功：订单变 REFUNDED 且有 refundedAt', async () => {
    seedPaidOrder(1000);
    quotas.set(key('u1', 'PAPER_GENERATION'), {
      id: 'q1',
      userId: 'u1',
      quotaType: 'PAPER_GENERATION',
      balance: 5,
      totalOut: 0,
    });
    await service.createRefund({
      operatorId: 'admin',
      orderId: 'o1',
      reason: '全退',
    });
    expect(orders.get('o1')?.status).toBe('REFUNDED');
    expect(orders.get('o1')?.refundedAt).toBeInstanceOf(Date);
  });

  it('三方退款失败：订单回 PAID，退款单 FAILED + errorMessage', async () => {
    seedPaidOrder();
    wechatRefund.mockRejectedValueOnce(new Error('provider fail'));
    await expect(
      service.createRefund({
        operatorId: 'admin',
        orderId: 'o1',
        amountCents: 100,
        reason: 'x',
      }),
    ).rejects.toThrow('provider fail');
    const failed = [...refunds.values()].find((x) => x.status === 'FAILED');
    expect(orders.get('o1')?.status).toBe('PAID');
    expect(failed?.errorMessage).toContain('provider fail');
  });

  it('配额回滚不会导致负余额', async () => {
    seedPaidOrder(1000);
    quotas.set(key('u1', 'PAPER_GENERATION'), {
      id: 'q1',
      userId: 'u1',
      quotaType: 'PAPER_GENERATION',
      balance: 1,
      totalOut: 0,
    });
    await service.createRefund({
      operatorId: 'admin',
      orderId: 'o1',
      amountCents: 800,
      reason: 'x',
    });
    expect(quotas.get(key('u1', 'PAPER_GENERATION'))?.balance).toBe(0);
  });

  it('不传 amountCents 默认退剩余可退金额', async () => {
    seedPaidOrder(1000);
    refunds.set('r_ok', {
      id: 'r_ok',
      orderId: 'o1',
      amountCents: 300,
      status: 'SUCCESS',
      finishedAt: new Date(),
    });
    await service.createRefund({
      operatorId: 'admin',
      orderId: 'o1',
      reason: '剩余退',
    });
    const last = [...refunds.values()].at(-1)!;
    expect(last.amountCents).toBe(700);
  });
});
