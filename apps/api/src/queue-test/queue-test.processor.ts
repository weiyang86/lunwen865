import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

type TestJobData = { message: string; timestamp: number };
type TestJobResult = { result: string; finishedAt: string };

@Processor('test-queue', { concurrency: 2 })
export class QueueTestProcessor extends WorkerHost {
  private readonly logger = new Logger(QueueTestProcessor.name);

  async process(
    job: Job<TestJobData, TestJobResult, string>,
  ): Promise<TestJobResult> {
    this.logger.log(`开始处理任务 ${job.id}: ${job.data.message}`);

    // 模拟长耗时任务，10 秒
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((r) => setTimeout(r, 1000));
      await job.updateProgress(i);
      this.logger.log(`任务 ${job.id} 进度: ${i}%`);
    }

    return {
      result: `处理完成: ${job.data.message}`,
      finishedAt: new Date().toISOString(),
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<TestJobData, TestJobResult, string>) {
    this.logger.log(`✅ 任务 ${job.id} 完成`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<TestJobData, TestJobResult, string>, err: Error) {
    this.logger.error(`❌ 任务 ${job.id} 失败: ${err.message}`);
  }
}
