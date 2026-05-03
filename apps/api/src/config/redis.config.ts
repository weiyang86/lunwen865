import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB ?? '0', 10),
  queuePrefix: process.env.QUEUE_PREFIX || 'paper-system',
  concurrency: parseInt(process.env.QUEUE_CONCURRENCY ?? '2', 10),
}));
