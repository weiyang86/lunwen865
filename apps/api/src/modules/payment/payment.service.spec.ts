import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentChannel, PaymentMethod } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { OrderService } from '../order/order.service';
import type { QuotaService } from '../quota/quota.service';
import { PaymentService } from './payment.service';
import type { AlipayProvider } from './providers/alipay.provider';
import type { WechatPayProvider } from './providers/wechat-pay.provider';

type ProductRow = { id: string; name: string };

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
  expiresAt: Date;
  quotaGranted: boolean;
};

type RefundRow = {
  id: string;
  orderId: string;
  refundNo: string;
  outRefundNo: string | null;
  amountCents: number;
  reason: string;
  status: string;
  refundId: string | null;
  operatorId: string;
  finishedAt: Date | null;
};

type UserQuotaRow = {
  id: string;
  userId: string;
  quotaType: string;
  balance: number;
  totalOut: number;
};

describe('PaymentService', () => {
  const products = new Map<string, ProductRow>();
  const orders = new Map<string, OrderRow>();
  const refunds = new Map<string, RefundRow>();
  const userQuotas = new Map<string, UserQuotaRow>();
  const paymentLogs: Array<{ orderId: string; type: string }> = [];

  let prisma: PrismaService;
  let orderService: Pick<OrderService, 'markPaid'>;
  let quotaService: Pick<QuotaService, 'refund'>;
  let config: Pick<ConfigService, 'get'>;
  let wechat: Pick<
    WechatPayProvider,
    'nativePrepay' | 'refund' | 'verifyAndParsePayNotify'
  >;
  let alipay: Pick<
    AlipayProvider,
    'pagePay' | 'refund' | 'verifyAndParsePayNotify'
  >;
  let service: PaymentService;

  beforeEach(() => {
    products.clear();
    orders.clear();
    refunds.clear();
    userQuotas.clear();
    paymentLogs.length = 0;

    config = {
      get: jest.fn((key: string, def?: unknown) => {
        if (key === 'payment.sandbox') return true;
        if (key === 'payment.alipay.returnUrl') return '';
        return def;
      }),
    };

    wechat = {
      nativePrepay: jest.fn(({ outTradeNo }: { outTradeNo: string }) =>
        Promise.resolve({ codeUrl: `weixin://mock?o=${outTradeNo}` }),
      ),
      refund: jest.fn(({ outRefundNo }: { outRefundNo: string }) =>
        Promise.resolve({ outRefundNo, refundId: 'WX_REF_1' }),
      ),
      verifyAndParsePayNotify: jest.fn(),
    };

    alipay = {
      pagePay: jest.fn(({ outTradeNo }: { outTradeNo: string }) =>
        Promise.resolve({
          paymentUrl: `https://mock.alipay/pay?o=${outTradeNo}`,
        }),
      ),
      refund: jest.fn(({ outRefundNo }: { outRefundNo: string }) =>
        Promise.resolve({ outRefundNo, refundId: 'ALI_REF_1' }),
      ),
      verifyAndParsePayNotify: jest.fn(),
    };

    orderService = {
      markPaid: jest.fn(() =>
        Promise.resolve({
          order: { id: 'o1', status: 'PAID' },
          alreadyPaid: false,
        }),
      ),
    } as unknown as Pick<OrderService, 'markPaid'>;

    quotaService = {
      refund: jest.fn(() => Promise.resolve()),
    };

    const quotaKey = (userId: string, quotaType: string) =>
      `${userId}:${quotaType}`;
    const findOrderById = (
      id: string,
      includeProduct: boolean,
      includeRefunds: boolean,
    ) => {
      const o = orders.get(id);
      if (!o) return null;
      if (!includeProduct && !includeRefunds) return o;
      const attached: Record<string, unknown> = { ...o };
      if (includeRefunds) {
        attached['refunds'] = [...refunds.values()].filter(
          (x) => x.orderId === id,
        );
      }
      if (!includeProduct) return attached;
      const p = products.get(o.productId);
      return p ? { ...attached, product: p } : null;
    };

    type OrderFindUniqueArgs = {
      where: { id: string };
      include?: { product?: boolean; refunds?: boolean };
    };
    type OrderUpdateArgs = { where: { id: string }; data: Partial<OrderRow> };
    type OrderFindFirstArgs = {
      where: { OR: Array<{ outTradeNo?: string } | { orderNo?: string }> };
    };
    type RefundCreateArgs = {
      data: {
        orderId: string;
        refundNo: string;
        outRefundNo?: string | null;
        amountCents: number;
        reason: string;
        status: string;
        refundId?: string | null;
        operatorId: string;
      };
    };
    type RefundFindFirstArgs = { where: { outRefundNo: string } };
    type RefundFindUniqueArgs = {
      where: { id: string };
      include?: { order?: boolean };
    };
    type RefundUpdateArgs = { where: { id: string }; data: Partial<RefundRow> };
    type PaymentLogCreateArgs = { data: { orderId: string; type: unknown } };
    type TxClient = {
      order: {
        findUnique: (args: OrderFindUniqueArgs) => Promise<unknown>;
        update: (args: OrderUpdateArgs) => Promise<unknown>;
        findFirst: (args: OrderFindFirstArgs) => Promise<unknown>;
      };
      refund: {
        create: (args: RefundCreateArgs) => Promise<unknown>;
        findFirst: (args: RefundFindFirstArgs) => Promise<unknown>;
        findUnique: (args: RefundFindUniqueArgs) => Promise<unknown>;
        update: (args: RefundUpdateArgs) => Promise<unknown>;
        aggregate: (args: {
          where: { orderId: string; status: string };
          _sum: { amountCents: true };
        }) => Promise<{ _sum: { amountCents: number } }>;
      };
      paymentLog: {
        create: (args: PaymentLogCreateArgs) => Promise<unknown>;
      };
      userQuota: {
        findUnique: (args: {
          where: { userId_quotaType: { userId: string; quotaType: string } };
        }) => Promise<UserQuotaRow | null>;
        update: (args: {
          where: { id: string };
          data: {
            balance?: { decrement: number };
            totalOut?: { increment: number };
          };
        }) => Promise<UserQuotaRow>;
      };
      quotaLog: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
      };
    };

    const txClient = {} as TxClient;
    const prismaMock = {
      order: {
        findUnique: jest.fn((args: OrderFindUniqueArgs) =>
          Promise.resolve(
            findOrderById(
              args.where.id,
              Boolean(args.include?.product),
              Boolean(args.include?.refunds),
            ),
          ),
        ),
        update: jest.fn((args: OrderUpdateArgs) => {
          const existing = orders.get(args.where.id);
          if (!existing) return Promise.reject(new Error('order not found'));
          const updated: OrderRow = { ...existing, ...args.data };
          orders.set(existing.id, updated);
          return Promise.resolve(updated);
        }),
        findFirst: jest.fn((args: OrderFindFirstArgs) => {
          const a0 = args.where.OR[0] as { outTradeNo?: string };
          const a1 = args.where.OR[1] as { orderNo?: string };
          const outTradeNo = a0.outTradeNo ?? a1.orderNo ?? '';
          for (const o of orders.values()) {
            if (o.outTradeNo === outTradeNo || o.orderNo === outTradeNo)
              return o;
          }
          return Promise.resolve(null);
        }),
      },
      refund: {
        create: jest.fn((args: RefundCreateArgs) => {
          const id = `r_${refunds.size + 1}`;
          const row: RefundRow = {
            id,
            orderId: args.data.orderId,
            refundNo: args.data.refundNo,
            outRefundNo: args.data.outRefundNo ?? null,
            amountCents: args.data.amountCents,
            reason: args.data.reason,
            status: args.data.status,
            refundId: args.data.refundId ?? null,
            operatorId: args.data.operatorId,
            finishedAt: null,
          };
          refunds.set(id, row);
          return Promise.resolve(row);
        }),
        findFirst: jest.fn((args: RefundFindFirstArgs) => {
          for (const r of refunds.values()) {
            if (r.outRefundNo === args.where.outRefundNo) return r;
          }
          return Promise.resolve(null);
        }),
        findUnique: jest.fn((args: RefundFindUniqueArgs) => {
          const r = refunds.get(args.where.id) ?? null;
          if (!r) return Promise.resolve(null);
          if (!args.include?.order) return Promise.resolve(r);
          const order = orders.get(r.orderId);
          return Promise.resolve(order ? { ...r, order } : null);
        }),
        update: jest.fn((args: RefundUpdateArgs) => {
          const existing = refunds.get(args.where.id);
          if (!existing) return Promise.reject(new Error('refund not found'));
          const updated: RefundRow = { ...existing, ...args.data };
          refunds.set(existing.id, updated);
          return Promise.resolve(updated);
        }),
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
      paymentLog: {
        create: jest.fn((args: PaymentLogCreateArgs) => {
          paymentLogs.push({
            orderId: args.data.orderId,
            type: String(args.data.type),
          });
          return Promise.resolve({ id: `pl_${paymentLogs.length}` });
        }),
      },
      userQuota: {
        findUnique: jest.fn(
          (args: {
            where: { userId_quotaType: { userId: string; quotaType: string } };
          }) => {
            const key = quotaKey(
              args.where.userId_quotaType.userId,
              args.where.userId_quotaType.quotaType,
            );
            return Promise.resolve(userQuotas.get(key) ?? null);
          },
        ),
        update: jest.fn(
          (args: {
            where: { id: string };
            data: {
              balance?: { decrement: number };
              totalOut?: { increment: number };
            };
          }) => {
            const existing = [...userQuotas.values()].find(
              (x) => x.id === args.where.id,
            );
            if (!existing) return Promise.reject(new Error('quota not found'));
            const next: UserQuotaRow = {
              ...existing,
              balance: existing.balance - (args.data.balance?.decrement ?? 0),
              totalOut:
                existing.totalOut + (args.data.totalOut?.increment ?? 0),
            };
            userQuotas.set(quotaKey(next.userId, next.quotaType), next);
            return Promise.resolve(next);
          },
        ),
      },
      quotaLog: {
        create: jest.fn(() => Promise.resolve({ id: 'ql_1' })),
      },
      $transaction: jest.fn(<T>(fn: (tx: TxClient) => Promise<T>) =>
        fn(txClient),
      ),
    };

    Object.assign(txClient, prismaMock as unknown as TxClient);
    prisma = prismaMock as unknown as PrismaService;

    service = new PaymentService(
      prisma,
      orderService as OrderService,
      quotaService as QuotaService,
      config as ConfigService,
      wechat as unknown as WechatPayProvider,
      alipay as unknown as AlipayProvider,
    );
  });

  it('prepay：订单不存在 → 404', async () => {
    await expect(
      service.prepay(
        'u1',
        {
          orderId: 'o1',
          channel: PaymentChannel.WECHAT,
          method: PaymentMethod.WECHAT_NATIVE,
        },
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prepay：跨用户 → 403', async () => {
    products.set('p1', { id: 'p1', name: '体验包' });
    orders.set('o1', {
      id: 'o1',
      orderNo: 'PAY1',
      userId: 'u2',
      productId: 'p1',
      productSnapshot: { paperQuota: 1 },
      amountCents: 100,
      paidAmountCents: null,
      status: 'PENDING',
      channel: null,
      method: null,
      outTradeNo: null,
      transactionId: null,
      expiresAt: new Date(Date.now() + 60_000),
      quotaGranted: false,
    });

    await expect(
      service.prepay(
        'u1',
        {
          orderId: 'o1',
          channel: PaymentChannel.WECHAT,
          method: PaymentMethod.WECHAT_NATIVE,
        },
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prepay：订单过期 → 400', async () => {
    products.set('p1', { id: 'p1', name: '体验包' });
    orders.set('o1', {
      id: 'o1',
      orderNo: 'PAY1',
      userId: 'u1',
      productId: 'p1',
      productSnapshot: { paperQuota: 1 },
      amountCents: 100,
      paidAmountCents: null,
      status: 'PENDING',
      channel: null,
      method: null,
      outTradeNo: null,
      transactionId: null,
      expiresAt: new Date(Date.now() - 1),
      quotaGranted: false,
    });

    await expect(
      service.prepay(
        'u1',
        {
          orderId: 'o1',
          channel: PaymentChannel.WECHAT,
          method: PaymentMethod.WECHAT_NATIVE,
        },
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prepay：WECHAT_NATIVE 返回 codeUrl 并写 PREPAY 日志', async () => {
    products.set('p1', { id: 'p1', name: '体验包' });
    orders.set('o1', {
      id: 'o1',
      orderNo: 'PAY1',
      userId: 'u1',
      productId: 'p1',
      productSnapshot: { paperQuota: 1 },
      amountCents: 100,
      paidAmountCents: null,
      status: 'PENDING',
      channel: null,
      method: null,
      outTradeNo: null,
      transactionId: null,
      expiresAt: new Date(Date.now() + 60_000),
      quotaGranted: false,
    });

    const res = await service.prepay(
      'u1',
      {
        orderId: 'o1',
        channel: PaymentChannel.WECHAT,
        method: PaymentMethod.WECHAT_NATIVE,
      },
      '127.0.0.1',
    );

    const codeUrl = (res as unknown as Record<string, unknown>)['codeUrl'];
    expect(typeof codeUrl).toBe('string');
    expect(String(codeUrl)).toContain('weixin://mock');
    expect(paymentLogs.some((l) => l.type === 'PREPAY')).toBe(true);
  });

  it('handleWechatPayNotify（sandbox）：调用 markPaid', async () => {
    orders.set('o1', {
      id: 'o1',
      orderNo: 'PAY1',
      userId: 'u1',
      productId: 'p1',
      productSnapshot: {},
      amountCents: 100,
      paidAmountCents: null,
      status: 'PENDING',
      channel: PaymentChannel.WECHAT,
      method: PaymentMethod.WECHAT_NATIVE,
      outTradeNo: 'PAY1',
      transactionId: null,
      expiresAt: new Date(Date.now() + 60_000),
      quotaGranted: false,
    });

    await service.handleWechatPayNotify({
      headers: {},
      rawBody: '{}',
      body: { outTradeNo: 'PAY1', transactionId: 'TX1', paidAmountCents: 100 },
    });

    expect(orderService.markPaid).toHaveBeenCalled();
  });

  it('applyRefund：非 PAID → 400', async () => {
    orders.set('o1', {
      id: 'o1',
      orderNo: 'PAY1',
      userId: 'u1',
      productId: 'p1',
      productSnapshot: {},
      amountCents: 100,
      paidAmountCents: null,
      status: 'PENDING',
      channel: PaymentChannel.WECHAT,
      method: PaymentMethod.WECHAT_NATIVE,
      outTradeNo: 'PAY1',
      transactionId: 'TX1',
      expiresAt: new Date(Date.now() + 60_000),
      quotaGranted: false,
    });

    await expect(
      service.applyRefund('admin1', {
        orderId: 'o1',
        amountCents: 1,
        reason: '测试',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applyRefund（sandbox）：成功后订单变 REFUNDED 且调用 quota.refund', async () => {
    orders.set('o1', {
      id: 'o1',
      orderNo: 'PAY1',
      userId: 'u1',
      productId: 'p1',
      productSnapshot: { paperQuota: 1, polishQuota: 2, exportQuota: 3 },
      amountCents: 100,
      paidAmountCents: 100,
      status: 'PAID',
      channel: PaymentChannel.WECHAT,
      method: PaymentMethod.WECHAT_NATIVE,
      outTradeNo: 'PAY1',
      transactionId: 'TX1',
      expiresAt: new Date(Date.now() + 60_000),
      quotaGranted: true,
    });
    userQuotas.set('u1:PAPER_GENERATION', {
      id: 'q1',
      userId: 'u1',
      quotaType: 'PAPER_GENERATION',
      balance: 1,
      totalOut: 0,
    });
    userQuotas.set('u1:POLISH', {
      id: 'q2',
      userId: 'u1',
      quotaType: 'POLISH',
      balance: 2,
      totalOut: 0,
    });
    userQuotas.set('u1:EXPORT', {
      id: 'q3',
      userId: 'u1',
      quotaType: 'EXPORT',
      balance: 3,
      totalOut: 0,
    });

    await service.applyRefund('admin1', { orderId: 'o1', reason: '测试退款' });

    expect(orders.get('o1')?.status).toBe('REFUNDED');
    expect(userQuotas.get('u1:PAPER_GENERATION')?.balance).toBe(0);
    expect(userQuotas.get('u1:POLISH')?.balance).toBe(0);
    expect(userQuotas.get('u1:EXPORT')?.balance).toBe(0);
  });
});
