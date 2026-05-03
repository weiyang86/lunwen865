import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { PrismaModule } from '../prisma/prisma.module'; // ✅ 加这一行

@Module({
  imports: [PrismaModule], // ✅ 必须导入
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
