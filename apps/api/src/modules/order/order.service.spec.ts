import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderSourceType,
  OrderStatus,
  PaymentChannel,
  PaymentMethod,
  ProductStatus,
  QuotaType,
  UserRole,
} from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaService } from '../quota/quota.service';
import type { SettingsService } from '../settings/settings.service';
import { OrderService } from './order.service';

type OrderCreateArgs = {
  data: {
    orderNo: string;
    userId: string;
    productId: string;
    productSnapshot: unknown;
    amountCents: number;
    status: OrderStatus;
    sourceType?: OrderSourceType;
    agencyId?: string | null;
    expiresAt: Date;
    remark?: string | null;
    clientIp?: string | null;
  };
};

type OrderUpdateArgs = {
  where: { id: string };
  data: {
    status?: OrderStatus;
    cancelledAt?: Date | null;
  };
};

type PrismaMock = {
  product: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
  order: {
    create: (args: OrderCreateArgs) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: OrderUpdateArgs) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
  };
  userQuota: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
  $transaction: <T>(fn: (tx: PrismaMock) => Promise<T>) => Promise<T>;
};

type TxFn<T> = (tx: PrismaMock) => Promise<T>;

describe('OrderService', () => {
  let prisma: DeepMockProxy<PrismaMock>;
  let quotaService: DeepMockProxy<QuotaService>;
  let config: DeepMockProxy<ConfigService>;
  let settings: Pick<SettingsService, 'getPaymentSettings'>;
  let service: OrderService;

  beforeEach(() => {
    prisma = mockDeep<PrismaMock>();
    quotaService = mockDeep<QuotaService>();
    config = mockDeep<ConfigService>();
    settings = {
      getPaymentSettings: jest.fn(() =>
        Promise.resolve({
          sandbox: true,
          orderExpireMinutes: 30,
          wechat: {
            notifyUrl: '',
            appid: '',
            mchid: '',
            serialNo: '',
            privateKeyPath: '',
            apiV3Key: '',
          },
          alipay: {
            notifyUrl: '',
            returnUrl: '',
            appId: '',
            gateway: '',
            privateKeyPath: '',
            publicKeyPath: '',
          },
        }),
      ),
    };

    prisma.$transaction.mockImplementation((fn: TxFn<unknown>) => fn(prisma));

    service = new OrderService(
      prisma as unknown as PrismaService,
      quotaService,
      config,
      settings as unknown as SettingsService,
    );
  });

  it('create：商品不存在 → 404', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(
      service.create('u1', { productId: 'p1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create：商品下架 → 400', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      code: 'TRIAL',
      name: '体验包',
      description: null,
      priceCents: 100,
      originalPriceCents: null,
      brainCellAmount: 0,
      paperQuota: 1,
      polishQuota: 3,
      exportQuota: 2,
      aiChatQuota: 0,
      status: ProductStatus.INACTIVE,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.create('u1', { productId: 'p1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create 成功：状态 PENDING、expiresAt = 30min 后', async () => {
    config.get.mockReturnValue(30);
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      code: 'TRIAL',
      name: '体验包',
      description: null,
      priceCents: 100,
      originalPriceCents: null,
      brainCellAmount: 0,
      paperQuota: 1,
      polishQuota: 3,
      exportQuota: 2,
      aiChatQuota: 0,
      status: ProductStatus.ACTIVE,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    prisma.order.create.mockImplementation((args: OrderCreateArgs) =>
      Promise.resolve({
        id: 'o1',
        orderNo: args.data.orderNo,
        userId: args.data.userId,
        productId: args.data.productId,
        productSnapshot: args.data.productSnapshot,
        amountCents: args.data.amountCents,
        paidAmountCents: null,
        status: args.data.status,
        channel: null,
        method: null,
        outTradeNo: null,
        transactionId: null,
        expiresAt: args.data.expiresAt,
        paidAt: null,
        cancelledAt: null,
        refundedAt: null,
        quotaGranted: false,
        remark: args.data.remark ?? null,
        clientIp: args.data.clientIp ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any),
    );

    const before = Date.now();
    const order = await service.create('u1', { productId: 'p1' }, '127.0.0.1');
    const after = Date.now();

    expect(order.status).toBe(OrderStatus.PENDING);
    const expMs = new Date(order.expiresAt).getTime();
    expect(expMs).toBeGreaterThanOrEqual(before + 29 * 60_000);
    expect(expMs).toBeLessThanOrEqual(after + 31 * 60_000);
  });

  it('findOne 跨用户 → 403', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      userId: 'u2',
    });

    await expect(service.findOne('u1', 'o1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('cancel：非 PENDING → 400', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      userId: 'u1',
      status: OrderStatus.PAID,
      product: {},
      refunds: [],
    });

    await expect(service.cancel('u1', 'o1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('cancel 成功：状态 CANCELLED + cancelledAt', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      userId: 'u1',
      status: OrderStatus.PENDING,
      product: {},
      refunds: [],
    });

    prisma.order.update.mockImplementation((args: OrderUpdateArgs) =>
      Promise.resolve({
        id: args.where.id,
        userId: 'u1',
        status: args.data.status,
        cancelledAt: args.data.cancelledAt,
      } as any),
    );

    const updated = await service.cancel('u1', 'o1');
    expect(updated.status).toBe(OrderStatus.CANCELLED);
    expect(updated.cancelledAt).toBeInstanceOf(Date);
  });

  it('markPaid 重复回调：alreadyPaid=true，配额不重发', async () => {
    const grantSpy = jest.spyOn(quotaService, 'grant');
    const updateSpy = jest.spyOn(prisma.order, 'update');

    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      userId: 'u1',
      status: OrderStatus.PAID,
      amountCents: 100,
    });

    const res = await service.markPaid({
      orderId: 'o1',
      transactionId: 'tx1',
      paidAmountCents: 100,
      method: PaymentMethod.WECHAT_NATIVE,
      channel: PaymentChannel.WECHAT,
      paidAt: new Date(),
    });

    expect(res.alreadyPaid).toBe(true);
    expect(grantSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('markPaid 成功：发放脑细胞（从商品快照推导）', async () => {
    const grantSpy = jest.spyOn(quotaService, 'grant');
    const updateSpy = jest.spyOn(prisma.order, 'update');

    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      userId: 'u1',
      status: OrderStatus.PENDING,
      amountCents: 100,
    });

    prisma.order.update
      .mockResolvedValueOnce({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.PAID,
        amountCents: 100,
        paidAmountCents: 100,
        productSnapshot: {
          paperQuota: 1,
          polishQuota: 2,
          exportQuota: 3,
          aiChatQuota: 4,
        },
        quotaGranted: false,
      })
      .mockResolvedValueOnce({ id: 'o1', quotaGranted: true });

    const res = await service.markPaid({
      orderId: 'o1',
      transactionId: 'tx1',
      paidAmountCents: 100,
      method: PaymentMethod.WECHAT_NATIVE,
      channel: PaymentChannel.WECHAT,
      paidAt: new Date(),
    });

    expect(res.alreadyPaid).toBe(false);
    expect(grantSpy).toHaveBeenCalledTimes(1);
    expect(grantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: QuotaType.BRAIN_CELL,
        amount: 10,
      }),
    );
    expect(updateSpy).toHaveBeenCalledTimes(2);
  });

  it('markPaid 金额不匹配：仍然成功但 logger.warn', async () => {
    const warnSpy = jest
      .spyOn((service as unknown as { logger: Logger }).logger, 'warn')
      .mockImplementation(() => undefined);

    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      userId: 'u1',
      status: OrderStatus.PENDING,
      amountCents: 100,
    });

    prisma.order.update
      .mockResolvedValueOnce({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.PAID,
        amountCents: 100,
        paidAmountCents: 101,
        productSnapshot: {},
        quotaGranted: false,
      })
      .mockResolvedValueOnce({ id: 'o1', quotaGranted: true });

    await service.markPaid({
      orderId: 'o1',
      transactionId: 'tx1',
      paidAmountCents: 101,
      method: PaymentMethod.WECHAT_NATIVE,
      channel: PaymentChannel.WECHAT,
      paidAt: new Date(),
    });

    expect(warnSpy).toHaveBeenCalled();
  });

  it('getPaymentStatus：用户不能查询他人订单', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      orderNo: 'NO1',
      userId: 'u2',
      status: OrderStatus.PENDING,
      taskId: null,
      task: null,
    });

    await expect(
      service.getPaymentStatus({ id: 'u1', role: UserRole.USER }, 'o1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getPaymentStatus：paid 订单返回站内 redirectUrl、taskId 与脑细胞余额', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      orderNo: 'NO1',
      userId: 'u1',
      status: OrderStatus.PAID,
      paidAt: new Date('2026-01-01T00:00:00Z'),
      paidAmountCents: 100,
      channel: PaymentChannel.WECHAT,
      method: PaymentMethod.WECHAT_NATIVE,
      outTradeNo: 'NO1',
      transactionId: 'TX1',
      expiresAt: new Date('2026-01-01T01:00:00Z'),
      taskId: 't1',
      task: { id: 't1' },
    });
    prisma.userQuota.findUnique.mockResolvedValue({ balance: 88 });

    const status = await service.getPaymentStatus(
      { id: 'u1', role: UserRole.USER },
      'o1',
    );

    expect(status.paid).toBe(true);
    expect(status.redirectUrl).toBe('/tasks?taskId=t1');
    expect(status.redirectUrl.startsWith('/')).toBe(true);
    expect(status.brainCellBalance).toBe(88);
  });

  it('closeExpired：到期 PENDING 订单被关闭，未到期不动', async () => {
    const updateManySpy = jest.spyOn(prisma.order, 'updateMany');

    prisma.order.findMany.mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]);
    prisma.order.updateMany.mockResolvedValue({ count: 2 });

    const n = await service.closeExpired();
    expect(n).toBe(2);
    expect(updateManySpy).toHaveBeenCalled();
  });
});
