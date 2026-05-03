import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExportService } from './export.service';

@Injectable()
export class ExportCleanupService {
  private readonly logger = new Logger(ExportCleanupService.name);

  constructor(private readonly exportService: ExportService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCleanup() {
    const n = await this.exportService.cleanupExpired();
    this.logger.log(`[ExportCleanup] 清理过期文件 ${n} 个`);
  }
}
