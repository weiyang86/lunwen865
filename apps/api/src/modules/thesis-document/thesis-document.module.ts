import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TaskModule } from '../task/task.module';
import { AdminThesisDocumentController } from './admin-thesis-document.controller';
import { ThesisDocumentController } from './thesis-document.controller';
import { ThesisDocumentService } from './thesis-document.service';

@Module({
  imports: [PrismaModule, TaskModule],
  controllers: [ThesisDocumentController, AdminThesisDocumentController],
  providers: [ThesisDocumentService],
  exports: [ThesisDocumentService],
})
export class ThesisDocumentModule {}
