import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PolishStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PolishProcessor } from './polish.processor';

@Injectable()
export class PolishQueue implements OnModuleInit {
  private readonly logger = new Logger(PolishQueue.name);
  private readonly processing = new Set<string>();
  private readonly scheduled = new Set<string>();
  private readonly MAX_CONCURRENT = 3;
  private readonly waitQueue: string[] = [];

  constructor(
    private readonly processor: PolishProcessor,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const stuck = await this.prisma.polishTask.findMany({
      where: { status: PolishStatus.PROCESSING },
      select: { id: true },
    });
    if (stuck.length === 0) return;

    const ids = stuck.map((x) => x.id);
    await this.prisma.polishTask.updateMany({
      where: { id: { in: ids } },
      data: {
        status: PolishStatus.FAILED,
        errorMessage: '服务重启，请重试',
        completedAt: new Date(),
      },
    });

    await this.prisma.polishSegment.updateMany({
      where: { polishTaskId: { in: ids }, status: PolishStatus.PROCESSING },
      data: { status: PolishStatus.FAILED, errorMessage: '服务重启，请重试' },
    });

    this.logger.warn(`recovered tasks=${ids.length}`);
  }

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
