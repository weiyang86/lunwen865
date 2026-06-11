import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaModule } from '../quota/quota.module';
import { AdminExportController } from './admin-export.controller';
import { AdminExportService } from './admin-export.service';
import { ExportCleanupService } from './export.cleanup';
import { ExportController } from './export.controller';
import { ExportProcessor } from './export.processor';
import { ExportQueue } from './export.queue';
import { ExportService } from './export.service';
import { DocxBuilder } from './builders/docx.builder';
import { CoverBuilder } from './builders/cover.builder';
import { AbstractBuilder } from './builders/abstract.builder';
import { TocBuilder } from './builders/toc.builder';
import { ContentBuilder } from './builders/content.builder';
import { ReferenceBuilder } from './builders/reference.builder';
import { RevisionBuilder } from './builders/revision.builder';
import { ExportStatus } from '@prisma/client';
import { TaskModule } from '../task/task.module';
import { ThesisDocxExportService } from './thesis-docx-export.service';
import { ThesisExportTemplateService } from './thesis-export-template.service';
import { ThesisExportService } from './thesis-export.service';
import { ThesisExportController } from './thesis-export.controller';
import { AdminThesisFormatTemplateController } from './admin-thesis-format-template.controller';

@Module({
  imports: [PrismaModule, QuotaModule, TaskModule],
  controllers: [
    ExportController,
    AdminExportController,
    ThesisExportController,
    AdminThesisFormatTemplateController,
  ],
  providers: [
    ExportService,
    AdminExportService,
    ExportQueue,
    ExportProcessor,
    ExportCleanupService,
    DocxBuilder,
    CoverBuilder,
    AbstractBuilder,
    TocBuilder,
    ContentBuilder,
    ReferenceBuilder,
    RevisionBuilder,
    ThesisExportService,
    ThesisExportTemplateService,
    ThesisDocxExportService,
  ],
  exports: [ExportService, ThesisExportService, ThesisExportTemplateService],
})
export class ExportModule implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.exportTask.updateMany({
      where: { status: ExportStatus.PROCESSING },
      data: {
        status: ExportStatus.FAILED,
        errorMessage: '服务异常重启，请重试',
      },
    });
  }
}
