import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueTestController } from './queue-test.controller';
import { QueueTestProcessor } from './queue-test.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'test-queue',
    }),
  ],
  controllers: [QueueTestController],
  providers: [QueueTestProcessor],
})
export class QueueTestModule {}
