import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PrismaClient,
  ProductStatus,
  TaskStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

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

describe('ToC main flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  let userId: string | null = null;
  let orderId: string | null = null;
  let taskId: string | null = null;
  let productId: string | null = null;

  let userEmail = '';
  let adminEmail = '';

  beforeAll(async () => {
    process.env.PAYMENT_SANDBOX = 'true';

    prisma = new PrismaClient();
    const suffix = String(Date.now());
    userEmail = `toc_user_${suffix}@example.com`;
    adminEmail = `toc_admin_${suffix}@example.com`;

    const product = await prisma.product.create({
      data: {
        code: `TOC_E2E_${suffix}`,
        name: 'TOC E2E Product',
        description: 'toc e2e product',
        priceCents: 990,
        paperQuota: 2,
        polishQuota: 2,
        exportQuota: 1,
        aiChatQuota: 0,
        status: ProductStatus.ACTIVE,
        sortOrder: 0,
      },
      select: { id: true },
    });
    productId = product.id;

    await prisma.user.create({
      data: {
        email: adminEmail,
        password: await bcrypt.hash('Admin@123456', 10),
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        nickname: 'TOC E2E Admin',
        totalWordsQuota: 99999,
        registerChannel: 'e2e',
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    if (orderId) {
      await prisma.paymentLog.deleteMany({ where: { orderId } });
      await prisma.refund.deleteMany({ where: { orderId } });
      await prisma.quotaLog.deleteMany({ where: { orderId } });
      await prisma.order.deleteMany({ where: { id: orderId } });
    }

    if (taskId) {
      await prisma.task.deleteMany({ where: { id: taskId } });
    }

    if (userId) {
      await prisma.quotaLog.deleteMany({ where: { userId } });
      await prisma.userQuota.deleteMany({ where: { userId } });
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.loginLog.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }

    if (productId) {
      await prisma.product.deleteMany({ where: { id: productId } });
    }

    await prisma.user.deleteMany({ where: { email: adminEmail } });

    await app.close();
    await prisma.$disconnect();
  });

  it('To C: 注册/登录 -> 下单支付 -> 任务时间线', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: userEmail, password: 'User@123456', nickname: 'TOC User' })
      .expect(expectOk);

    const registerBody: unknown = registerRes.body;
    if (!isRecord(registerBody)) throw new Error('bad register response');

    const accessToken = getString(registerBody, 'accessToken');
    const user = registerBody['user'];
    if (!isRecord(user)) throw new Error('bad user object');
    userId = getString(user, 'id');

    expect(accessToken).toBeTruthy();
    expect(userId).toBeTruthy();

    const createOrderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId })
      .expect(expectOk);

    const createOrderBody: unknown = createOrderRes.body;
    if (!isRecord(createOrderBody)) throw new Error('bad order response');
    orderId = getString(createOrderBody, 'id');
    expect(orderId).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/payment/sandbox/simulate-paid')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ orderId })
      .expect(expectOk);

    const school = await prisma.school.findFirst({ select: { id: true } });
    if (!school?.id) throw new Error('missing school seed for e2e task create');

    const createTaskRes = await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        schoolId: school.id,
        major: '计算机科学与技术',
        educationLevel: 'UNDERGRADUATE',
        title: 'ToC E2E 任务',
        topic: 'ToC E2E 任务主题',
        keywords: ['E2E'],
        language: 'zh-CN',
        wordCountTarget: 3000,
      })
      .expect(expectOk);

    const createTaskBody: unknown = createTaskRes.body;
    if (!isRecord(createTaskBody)) throw new Error('bad task response');
    taskId = getString(createTaskBody, 'id');
    expect(taskId).toBeTruthy();

    await prisma.order.update({
      where: { id: orderId },
      data: { taskId },
    });

    const timelineRes = await request(app.getHttpServer())
      .get(`/api/tasks/${taskId}/timeline`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const timelineBody: unknown = timelineRes.body;
    if (!isRecord(timelineBody)) throw new Error('bad timeline response');
    const items = timelineBody['items'];
    expect(Array.isArray(items)).toBe(true);
    expect((items as unknown[]).length).toBeGreaterThan(0);

    const hasOrderLinked = (items as Array<Record<string, unknown>>).some(
      (item) => getString(item, 'type') === 'ORDER_LINKED',
    );
    expect(hasOrderLinked).toBe(true);

    const orderDetailRes = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const orderDetailBody: unknown = orderDetailRes.body;
    if (!isRecord(orderDetailBody))
      throw new Error('bad order detail response');
    const taskSummary = orderDetailBody['task'];
    if (!isRecord(taskSummary)) throw new Error('missing task summary');
    expect(getString(taskSummary, 'id')).toBe(taskId);

    const taskReloaded = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true },
    });
    expect(taskReloaded?.status).toBe(TaskStatus.INIT);
  });
});
