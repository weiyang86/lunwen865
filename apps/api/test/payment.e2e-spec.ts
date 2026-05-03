import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  PrismaClient,
  ProductStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { OrderService } from '../src/modules/order/order.service';
import { ReconcileService } from '../src/modules/payment/reconcile.service';

function expectOk(res: { status: number }) {
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`unexpected status ${res.status}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function getString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === 'string' ? v : '';
}

describe('Payment Flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  const createdOrderIds: string[] = [];
  let createdUserId: string | null = null;
  let createdProductId: string | null = null;
  let userEmail: string;
  let adminEmail: string;

  beforeAll(async () => {
    process.env.PAYMENT_SANDBOX = 'true';

    prisma = new PrismaClient();
    if (process.env.E2E_KEEP_DATA !== 'true') {
      const oldUsers = await prisma.user.findMany({
        where: { email: { startsWith: 'pay_user_' } },
        select: { id: true },
      });
      for (const u of oldUsers) {
        const orderIds = (
          await prisma.order.findMany({
            where: { userId: u.id },
            select: { id: true },
          })
        ).map((x) => x.id);
        if (orderIds.length) {
          await prisma.paymentLog.deleteMany({
            where: { orderId: { in: orderIds } },
          });
          await prisma.refund.deleteMany({
            where: { orderId: { in: orderIds } },
          });
          await prisma.quotaLog.deleteMany({
            where: { orderId: { in: orderIds } },
          });
          await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
        }
        await prisma.quotaLog.deleteMany({ where: { userId: u.id } });
        await prisma.loginLog.deleteMany({ where: { userId: u.id } });
        await prisma.userQuota.deleteMany({ where: { userId: u.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
        await prisma.user.deleteMany({ where: { id: u.id } });
      }
      await prisma.user.deleteMany({
        where: { email: { startsWith: 'pay_admin_' } },
      });
      await prisma.product.deleteMany({
        where: { code: { startsWith: 'BASIC_E2E_' } },
      });
    }

    const suffix = String(Date.now());
    userEmail = `pay_user_${suffix}@example.com`;
    adminEmail = `pay_admin_${suffix}@example.com`;

    const product = await prisma.product.create({
      data: {
        code: `BASIC_E2E_${suffix}`,
        name: 'BASIC E2E',
        description: 'e2e',
        priceCents: 1990,
        originalPriceCents: null,
        paperQuota: 5,
        polishQuota: 20,
        exportQuota: 10,
        aiChatQuota: 0,
        status: ProductStatus.ACTIVE,
        sortOrder: 0,
      },
      select: { id: true },
    });
    createdProductId = product.id;

    await prisma.user.create({
      data: {
        email: adminEmail,
        password: await bcrypt.hash('Admin@123456', 10),
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        nickname: 'E2E Admin',
        totalWordsQuota: 99999999,
        registerChannel: 'e2e',
      },
      select: { id: true },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    if (process.env.E2E_KEEP_DATA === 'true') {
      await app.close();
      await prisma.$disconnect();
      return;
    }

    const orderIds = [...createdOrderIds];

    if (orderIds.length) {
      await prisma.paymentLog.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.refund.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.quotaLog.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (createdUserId) {
      await prisma.quotaLog.deleteMany({ where: { userId: createdUserId } });
      await prisma.loginLog.deleteMany({ where: { userId: createdUserId } });
      await prisma.userQuota.deleteMany({ where: { userId: createdUserId } });
      await prisma.refreshToken.deleteMany({
        where: { userId: createdUserId },
      });
      await prisma.verifyCode.deleteMany({ where: { target: userEmail } });
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
    await prisma.refreshToken.deleteMany({
      where: { user: { email: adminEmail } },
    });
    await prisma.user.deleteMany({ where: { email: adminEmail } });
    if (createdProductId) {
      await prisma.product.deleteMany({ where: { id: createdProductId } });
    }

    await app.close();
    await prisma.$disconnect();
  });

  it('链路A/B/C：注册 -> 下单 -> 预下单 -> 模拟支付 -> 查询订单/配额 -> 管理员退款', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: userEmail, password: 'User@123456', nickname: 'E2E User' })
      .expect(expectOk);
    const registerBodyUnknown: unknown = registerRes.body;
    if (!isRecord(registerBodyUnknown))
      throw new Error('bad register response');
    const accessToken = getString(registerBodyUnknown, 'accessToken');
    const userUnknown = registerBodyUnknown['user'];
    if (!isRecord(userUnknown)) throw new Error('bad register user');
    createdUserId = getString(userUnknown, 'id');
    expect(accessToken).toBeTruthy();
    expect(createdUserId).toBeTruthy();

    const productRes = await request(app.getHttpServer())
      .get('/api/products')
      .expect(200);
    const products = productRes.body as Array<{ id: string; code: string }>;
    const product = products.find((p) => p.id === createdProductId);
    expect(product?.id).toBe(createdProductId);

    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId: createdProductId })
      .expect(expectOk);
    const orderBodyUnknown: unknown = orderRes.body;
    if (!isRecord(orderBodyUnknown)) throw new Error('bad order response');
    const createdOrderId = getString(orderBodyUnknown, 'id');
    createdOrderIds.push(createdOrderId);
    expect(createdOrderId).toBeTruthy();

    const prepayRes = await request(app.getHttpServer())
      .post('/api/payment/prepay')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        orderId: createdOrderId,
        channel: 'WECHAT',
        method: 'WECHAT_NATIVE',
      })
      .expect(expectOk);
    const prepayBodyUnknown: unknown = prepayRes.body;
    if (!isRecord(prepayBodyUnknown)) throw new Error('bad prepay response');
    expect(getString(prepayBodyUnknown, 'codeUrl')).toContain('weixin://');

    await request(app.getHttpServer())
      .post('/api/payment/sandbox/simulate-paid')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ orderId: createdOrderId })
      .expect(expectOk);

    const paidOrderRes = await request(app.getHttpServer())
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const paidOrderBodyUnknown: unknown = paidOrderRes.body;
    if (!isRecord(paidOrderBodyUnknown)) throw new Error('bad order detail');
    expect(getString(paidOrderBodyUnknown, 'status')).toBe('PAID');

    const quotaBeforeRefundRes = await request(app.getHttpServer())
      .get('/api/quota/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const quotaBeforeRefund = quotaBeforeRefundRes.body as Record<
      string,
      number
    >;

    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login/email')
      .send({ email: adminEmail, password: 'Admin@123456' })
      .expect(expectOk);
    const adminBodyUnknown: unknown = adminLoginRes.body;
    if (!isRecord(adminBodyUnknown))
      throw new Error('bad admin login response');
    const adminToken = getString(adminBodyUnknown, 'accessToken');
    expect(adminToken).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/admin/payment/refund')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderId: createdOrderId, reason: 'e2e refund' })
      .expect(expectOk);

    const refundedOrderRes = await request(app.getHttpServer())
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const refundedOrderBodyUnknown: unknown = refundedOrderRes.body;
    if (!isRecord(refundedOrderBodyUnknown))
      throw new Error('bad refunded order detail');
    expect(getString(refundedOrderBodyUnknown, 'status')).toBe('REFUNDED');

    const quotaAfterRefundRes = await request(app.getHttpServer())
      .get('/api/quota/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const quotaAfterRefund = quotaAfterRefundRes.body as Record<string, number>;

    const paperBefore = Number(quotaBeforeRefund['PAPER_GENERATION'] ?? 0);
    const polishBefore = Number(quotaBeforeRefund['POLISH'] ?? 0);
    const exportBefore = Number(quotaBeforeRefund['EXPORT'] ?? 0);
    expect(Number(quotaAfterRefund['PAPER_GENERATION'] ?? 0)).toBe(
      paperBefore - Math.min(paperBefore, 5),
    );
    expect(Number(quotaAfterRefund['POLISH'] ?? 0)).toBe(
      polishBefore - Math.min(polishBefore, 20),
    );
    expect(Number(quotaAfterRefund['EXPORT'] ?? 0)).toBe(
      exportBefore - Math.min(exportBefore, 10),
    );
  });

  it('链路D/E：过期关闭 + 对账补偿', async () => {
    const orderService = app.get(OrderService);
    const reconcileService = app.get(ReconcileService);

    const expiredOrder = await prisma.order.create({
      data: {
        orderNo: `PAY_EXPIRED_${Date.now()}`,
        userId: createdUserId!,
        productId: createdProductId!,
        productSnapshot: {
          paperQuota: 0,
          polishQuota: 0,
          exportQuota: 0,
          aiChatQuota: 0,
        },
        amountCents: 100,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 31 * 60_000),
      },
      select: { id: true },
    });
    createdOrderIds.push(expiredOrder.id);

    const closed = await orderService.closeExpired();
    expect(closed).toBeGreaterThanOrEqual(1);

    const expiredReloaded = await prisma.order.findUnique({
      where: { id: expiredOrder.id },
      select: { status: true },
    });
    expect(expiredReloaded?.status).toBe('CANCELLED');

    const reconcileOrder = await prisma.order.create({
      data: {
        orderNo: `PAY_RECONCILE_${Date.now()}`,
        outTradeNo: `SIM_PAID_${Date.now()}`,
        userId: createdUserId!,
        productId: createdProductId!,
        productSnapshot: {
          paperQuota: 0,
          polishQuota: 0,
          exportQuota: 0,
          aiChatQuota: 0,
        },
        amountCents: 100,
        status: 'PENDING',
        channel: 'WECHAT',
        method: 'WECHAT_NATIVE',
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
      select: { id: true },
    });
    createdOrderIds.push(reconcileOrder.id);

    await reconcileService.reconcilePending();

    const reconciledReloaded = await prisma.order.findUnique({
      where: { id: reconcileOrder.id },
      select: { status: true, transactionId: true, paidAt: true },
    });
    expect(reconciledReloaded?.status).toBe('PAID');
    expect(typeof reconciledReloaded?.transactionId).toBe('string');
    expect(reconciledReloaded?.paidAt).toBeInstanceOf(Date);
  });
});
