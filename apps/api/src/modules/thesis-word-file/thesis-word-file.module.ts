import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExportModule } from '../export/export.module';
import { TaskModule } from '../task/task.module';
import { ThesisWordFileController } from './thesis-word-file.controller';
import { ThesisWordFileService } from './thesis-word-file.service';

@Module({
  imports: [PrismaModule, TaskModule, ExportModule],
  controllers: [ThesisWordFileController],
  providers: [ThesisWordFileService],
  exports: [ThesisWordFileService],
})
export class ThesisWordFileModule {}
