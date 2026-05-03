import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect((res) => {
        const body = res.body as unknown;
        expect(body && typeof body === 'object').toBe(true);
        const data = body as { message?: unknown; timestamp?: unknown };
        expect(data.message).toBe('Hello from API 🚀');
        expect(typeof data.timestamp).toBe('string');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
