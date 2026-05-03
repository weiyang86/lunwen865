import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import redisConfig from './config/redis.config';
import paymentConfig from './config/payment.config';
import { PrismaModule } from './prisma/prisma.module';
import { LlmModule } from './modules/llm/llm.module';
import { TaskModule } from './modules/task/task.module';
import { TopicModule } from './modules/topic/topic.module';
import { OpeningReportModule } from './modules/opening-report/opening-report.module';
import { OutlineModule } from './modules/outline/outline.module';
import { WritingModule } from './modules/writing/writing.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { BullModule } from '@nestjs/bullmq';
import { QueueTestModule } from './queue-test/queue-test.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { UserModule } from './modules/user/user.module';
import { PolishModule } from './modules/polish/polish.module';
import { ExportModule } from './modules/export/export.module';
import { QuotaModule } from './modules/quota/quota.module';
import { OrderModule } from './modules/order/order.module';
import { ProductModule } from './modules/product/product.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PromptModule } from './modules/prompt/prompt.module';
import { AdminModule } from './modules/admin/admin.module';
console.log('🔍 Redis ENV:', {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD ? '***' : 'EMPTY',
});
@Module({
  imports: [
    // ⚠️ 必须 isGlobal: true，并且 load 中包含 redisConfig
    ConfigModule.forRoot({
      isGlobal: true,
      load: [redisConfig, paymentConfig],
      envFilePath: '.env',
    }),
    PrismaModule,
    // ⚠️ 必须 inject ConfigService 才能拿到配置
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
          db: configService.get<number>('redis.db'),
        },
        prefix: configService.get<string>('redis.queuePrefix'),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 3600, count: 100 },
          removeOnFail: { age: 24 * 3600 },
        },
      }),
    }),
    QueueTestModule,
    TaskModule,
    LlmModule,
    TopicModule,
    OpeningReportModule,
    PromptModule,
    OutlineModule,
    WritingModule,
    ReferenceModule,
    AuthModule,
    UserModule,
    QuotaModule,
    PolishModule,
    ExportModule,
    ProductModule,
    OrderModule,
    PaymentModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
