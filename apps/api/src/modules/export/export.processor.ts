import { Injectable, Logger } from '@nestjs/common';
import { ExportStatus, QuotaType, type Prisma } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaService } from '../quota/quota.service';
import { DocxBuilder } from './builders/docx.builder';
import { sanitizeFilename } from './utils/filename.util';
import { buildSnapshot } from './utils/snapshot.util';

@Injectable()
export class ExportProcessor {
  private readonly logger = new Logger(ExportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly docxBuilder: DocxBuilder,
    private readonly quotaService: QuotaService,
  ) {}

  async process(taskId: string): Promise<void> {
    const task = await this.prisma.exportTask.findUnique({
      where: { id: taskId },
    });
    if (!task) return;

    let writtenFilePath: string | null = null;

    try {
      await this.update(taskId, {
        status: ExportStatus.PROCESSING,
        progress: 10,
      });

      const snapshot = await buildSnapshot(this.prisma, {
        paperId: task.paperId ?? undefined,
        polishTaskId: task.polishTaskId ?? undefined,
        scope: task.scope,
      });

      Object.assign(snapshot, {
        title: task.title,
        author: task.author ?? snapshot.author,
        school: task.school ?? snapshot.school,
        major: task.major ?? snapshot.major,
        studentId: task.studentId ?? snapshot.studentId,
        advisor: task.advisor ?? snapshot.advisor,
        abstract: task.abstract ?? snapshot.abstract,
        keywords: task.keywords
          ? task.keywords
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : snapshot.keywords,
      });

      await this.update(taskId, {
        progress: 30,
        contentSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      });

      const buffer = await this.docxBuilder.build(snapshot, task.template);
      await this.update(taskId, { progress: 70 });

      const dir = path.join(process.cwd(), 'uploads', 'exports', task.userId);
      await fs.promises.mkdir(dir, { recursive: true });

      const safeName = sanitizeFilename(
        `${task.title}_${task.template}_${Date.now()}.docx`,
      );
      const filePath = path.join(dir, `${task.id}.docx`);
      await fs.promises.writeFile(filePath, buffer);
      writtenFilePath = filePath;

      await this.quotaService.consume({
        userId: task.userId,
        type: QuotaType.EXPORT,
        amount: 1,
        bizId: task.id,
        remark: `导出: ${task.title}`,
      });

      await this.update(taskId, {
        status: ExportStatus.SUCCESS,
        progress: 100,
        filePath,
        fileName: safeName,
        fileSize: buffer.length,
      });
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error('未知错误');
      this.logger.error(
        `[Export] 任务 ${taskId} 失败: ${err.message}`,
        err.stack,
      );

      if (writtenFilePath) {
        try {
          await fs.promises.unlink(writtenFilePath);
        } catch (unlinkError: unknown) {
          void unlinkError;
        }
      }
      await this.update(taskId, {
        status: ExportStatus.FAILED,
        errorMessage: err.message.slice(0, 500),
      });
    }
  }

  private async update(id: string, data: Prisma.ExportTaskUpdateInput) {
    await this.prisma.exportTask.update({ where: { id }, data });
  }
}
