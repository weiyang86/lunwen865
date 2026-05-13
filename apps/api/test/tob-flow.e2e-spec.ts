import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, ProductStatus } from '@prisma/client';
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
  const value = obj[key];
  return typeof value === 'string' ? value : '';
}

describe('ToB main flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  let agencyUserId: string | null = null;
  let secondAgencyUserId: string | null = null;
  let studentUserId: string | null = null;
  let orderId: string | null = null;
  let taskId: string | null = null;
  let productId: string | null = null;

  const suffix = String(Date.now());
  const agencyEmail = `agency_user_${suffix}@example.com`;
  const agencyEmail2 = `agency_user2_${suffix}@example.com`;
  const studentEmail = `agency_student_${suffix}@example.com`;
  const agencyId = `agency_${suffix}`;

  beforeAll(async () => {
    process.env.PAYMENT_SANDBOX = 'true';

    prisma = new PrismaClient();

    const product = await prisma.product.create({
      data: {
        code: `TOB_E2E_${suffix}`,
        name: 'TOB E2E Product',
        description: 'tob e2e product',
        priceCents: 1290,
        paperQuota: 1,
        polishQuota: 1,
        exportQuota: 1,
        aiChatQuota: 0,
        status: ProductStatus.ACTIVE,
        sortOrder: 0,
      },
      select: { id: true },
    });
    productId = product.id;

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

    const ids = [agencyUserId, secondAgencyUserId, studentUserId].filter(
      (v): v is string => Boolean(v),
    );
    if (ids.length) {
      await prisma.quotaLog.deleteMany({ where: { userId: { in: ids } } });
      await prisma.userQuota.deleteMany({ where: { userId: { in: ids } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.loginLog.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }

    if (productId) {
      await prisma.product.deleteMany({ where: { id: productId } });
    }

    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it('To B: 机构代下单 -> 机构任务时间线可见性', async () => {
    const agencyReg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: agencyEmail,
        password: 'Agency@123456',
        nickname: 'Agency User',
      })
      .expect(expectOk);
    const agencyBody: unknown = agencyReg.body;
    if (!isRecord(agencyBody)) throw new Error('bad agency register');
    const agencyUser = agencyBody['user'];
    if (!isRecord(agencyUser)) throw new Error('bad agency user');
    agencyUserId = getString(agencyUser, 'id');

    await prisma.user.update({
      where: { id: agencyUserId },
      data: { registerChannel: `agency:${agencyId}` },
    });

    const agencyLogin = await request(app.getHttpServer())
      .post('/api/auth/login/email')
      .send({ email: agencyEmail, password: 'Agency@123456' })
      .expect(expectOk);
    const agencyLoginBody: unknown = agencyLogin.body;
    if (!isRecord(agencyLoginBody)) throw new Error('bad agency login');
    const agencyToken = getString(agencyLoginBody, 'accessToken');

    const studentReg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: studentEmail,
        password: 'Student@123456',
        nickname: 'Student User',
      })
      .expect(expectOk);
    const studentBody: unknown = studentReg.body;
    if (!isRecord(studentBody)) throw new Error('bad student register');
    const studentUser = studentBody['user'];
    if (!isRecord(studentUser)) throw new Error('bad student user');
    studentUserId = getString(studentUser, 'id');

    const createOrder = await request(app.getHttpServer())
      .post('/api/agency/orders')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ userId: studentUserId, productId, remark: 'ToB E2E order' })
      .expect(expectOk);
    const orderBody: unknown = createOrder.body;
    if (!isRecord(orderBody)) throw new Error('bad order response');
    orderId = getString(orderBody, 'id');
    expect(getString(orderBody, 'sourceType')).toBe('AGENCY');
    expect(getString(orderBody, 'agencyId')).toBe(agencyId);

    const school = await prisma.school.findFirst({ select: { id: true } });
    if (!school?.id) throw new Error('missing school seed for e2e task create');

    const studentLogin = await request(app.getHttpServer())
      .post('/api/auth/login/email')
      .send({ email: studentEmail, password: 'Student@123456' })
      .expect(expectOk);
    const studentLoginBody: unknown = studentLogin.body;
    if (!isRecord(studentLoginBody)) throw new Error('bad student login');
    const studentToken = getString(studentLoginBody, 'accessToken');

    const createTask = await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        schoolId: school.id,
        major: '软件工程',
        educationLevel: 'UNDERGRADUATE',
        title: 'ToB E2E Task',
        topic: 'ToB E2E 任务主题',
        keywords: ['ToB', 'E2E'],
        language: 'zh-CN',
        wordCountTarget: 2800,
      })
      .expect(expectOk);
    const taskBody: unknown = createTask.body;
    if (!isRecord(taskBody)) throw new Error('bad task response');
    taskId = getString(taskBody, 'id');

    await prisma.order.update({ where: { id: orderId }, data: { taskId } });

    const timelineRes = await request(app.getHttpServer())
      .get(`/api/agency/tasks/${taskId}/timeline`)
      .set('Authorization', `Bearer ${agencyToken}`)
      .expect(200);
    const timelineBody: unknown = timelineRes.body;
    if (!isRecord(timelineBody)) throw new Error('bad timeline response');
    const items = timelineBody['items'];
    expect(Array.isArray(items)).toBe(true);
    expect((items as unknown[]).length).toBeGreaterThan(0);

    const agencyReg2 = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: agencyEmail2,
        password: 'Agency2@123456',
        nickname: 'Agency User 2',
      })
      .expect(expectOk);
    const agencyBody2: unknown = agencyReg2.body;
    if (!isRecord(agencyBody2)) throw new Error('bad second agency register');
    const agencyUser2 = agencyBody2['user'];
    if (!isRecord(agencyUser2)) throw new Error('bad second agency user');
    secondAgencyUserId = getString(agencyUser2, 'id');

    await prisma.user.update({
      where: { id: secondAgencyUserId },
      data: { registerChannel: `agency:${agencyId}_other` },
    });

    const agencyLogin2 = await request(app.getHttpServer())
      .post('/api/auth/login/email')
      .send({ email: agencyEmail2, password: 'Agency2@123456' })
      .expect(expectOk);
    const agencyLoginBody2: unknown = agencyLogin2.body;
    if (!isRecord(agencyLoginBody2)) throw new Error('bad second agency login');
    const agencyToken2 = getString(agencyLoginBody2, 'accessToken');

    await request(app.getHttpServer())
      .get(`/api/agency/tasks/${taskId}/timeline`)
      .set('Authorization', `Bearer ${agencyToken2}`)
      .expect(403);
  });
});
