import { BullRootModuleOptions } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

export const queueConfigFactory = (
  configService: ConfigService,
): BullRootModuleOptions => ({
  connection: {
    host: configService.get<string>('redis.host'),
    port: configService.get<number>('redis.port'),
    password: configService.get<string>('redis.password'),
    db: configService.get<number>('redis.db'),
  },
  prefix: configService.get<string>('redis.queuePrefix'),
  defaultJobOptions: {
    attempts: 3, // 失败重试 3 次
    backoff: {
      type: 'exponential',
      delay: 5000, // 重试延迟基数 5s
    },
    removeOnComplete: {
      age: 3600, // 1 小时后清理已完成
      count: 100, // 最多保留 100 条
    },
    removeOnFail: {
      age: 24 * 3600, // 失败任务保留 24 小时
    },
  },
});
