import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { TaskModule } from '../../task/task.module';
import { AdminTasksController } from './admin-tasks.controller';
import { AdminTasksService } from './admin-tasks.service';

@Module({
  imports: [PrismaModule, TaskModule],
  controllers: [AdminTasksController],
  providers: [AdminTasksService],
})
export class AdminTasksModule {}
