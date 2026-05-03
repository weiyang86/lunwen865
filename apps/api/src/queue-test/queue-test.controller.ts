import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

type TestJobData = { message: string; timestamp: number };
type TestJobResult = { result: string; finishedAt: string };

@Controller('queue-test')
export class QueueTestController {
  constructor(
    @InjectQueue('test-queue')
    private readonly testQueue: Queue<TestJobData, TestJobResult, string>,
  ) {}

  /** 提交一个测试任务 */
  @Post()
  async create(@Body() body: { message: string }) {
    const job = await this.testQueue.add('hello', {
      message: body.message,
      timestamp: Date.now(),
    });
    return {
      jobId: job.id,
      message: '任务已加入队列',
    };
  }

  /** 查询任务状态 */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const job = await this.testQueue.getJob(id);
    if (!job) return { error: 'Job not found' };

    return {
      id: job.id,
      state: await job.getState(),
      progress: job.progress,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    };
  }
}
