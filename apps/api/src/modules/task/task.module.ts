import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QuotaModule } from '../quota/quota.module';
import { AgencyTaskController } from './agency-task.controller';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [PrismaModule, QuotaModule],
  controllers: [TaskController, AgencyTaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
