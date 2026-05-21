import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';
import { TaskModule } from '../task/task.module';
import { AbstractController } from './abstract.controller';
import { AbstractService } from './abstract.service';

@Module({
  imports: [PrismaModule, TaskModule, LlmModule],
  controllers: [AbstractController],
  providers: [AbstractService],
})
export class AbstractModule {}
