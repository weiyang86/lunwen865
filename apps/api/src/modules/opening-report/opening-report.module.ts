import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TaskModule } from '../task/task.module';
import { OpeningReportController } from './opening-report.controller';
import { OpeningReportSectionService } from './opening-report-section.service';
import { OpeningReportService } from './opening-report.service';

@Module({
  imports: [PrismaModule, TaskModule],
  controllers: [OpeningReportController],
  providers: [OpeningReportService, OpeningReportSectionService],
  exports: [OpeningReportService],
})
export class OpeningReportModule {}
