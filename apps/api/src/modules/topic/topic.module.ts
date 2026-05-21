import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QuotaModule } from '../quota/quota.module';
import { TaskModule } from '../task/task.module';
import { TopicController } from './topic.controller';
import { TopicService } from './topic.service';

@Module({
  imports: [PrismaModule, TaskModule, QuotaModule],
  controllers: [TopicController],
  providers: [TopicService],
  exports: [TopicService],
})
export class TopicModule {}
