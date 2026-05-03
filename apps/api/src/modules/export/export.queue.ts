import { Injectable, Logger } from '@nestjs/common';
import { ExportProcessor } from './export.processor';

@Injectable()
export class ExportQueue {
  private readonly logger = new Logger(ExportQueue.name);
  private readonly processing = new Set<string>();
  private readonly scheduled = new Set<string>();
  private readonly MAX_CONCURRENT = 2;
  private readonly waitQueue: string[] = [];

  constructor(private readonly processor: ExportProcessor) {}

  enqueue(taskId: string): void {
    if (this.scheduled.has(taskId) || this.processing.has(taskId)) return;
    this.scheduled.add(taskId);

    if (this.processing.size < this.MAX_CONCURRENT) {
      void this.run(taskId);
      return;
    }

    this.waitQueue.push(taskId);
  }

  private async run(taskId: string): Promise<void> {
    this.processing.add(taskId);
    try {
      await this.processor.process(taskId);
    } catch (e: unknown) {
      this.logger.error(`[Queue] 任务 ${taskId} 异常`, e as Error);
    } finally {
      this.processing.delete(taskId);
      this.scheduled.delete(taskId);
      const next = this.waitQueue.shift();
      if (next) void this.run(next);
    }
  }
}
