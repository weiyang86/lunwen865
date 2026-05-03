import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ExportStatus, QuotaType } from '@prisma/client';
import * as fs from 'node:fs';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportQueue } from './export.queue';
import type { CreateExportDto } from './dto/create-export.dto';
import type { QueryExportDto } from './dto/query-export.dto';
import type { ExportResultDto } from './dto/export-result.dto';
import { deleteFileIfExists } from './utils/cleanup.util';
import { QuotaService } from '../quota/quota.service';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: ExportQueue,
    private readonly quotaService: QuotaService,
  ) {}

  async create(userId: string, dto: CreateExportDto): Promise<ExportResultDto> {
    await this.quotaService.ensure(userId, QuotaType.EXPORT, 1);
    if (!dto.paperId && !dto.polishTaskId) {
      throw new BadRequestException('请提供论文ID或润色任务ID');
    }

    if (dto.polishTaskId) {
      const polish = await this.prisma.polishTask.findUnique({
        where: { id: dto.polishTaskId },
        select: { id: true, userId: true },
      });
      if (!polish) throw new NotFoundException('润色任务不存在');
      if (polish.userId !== userId)
        throw new ForbiddenException('无权访问该资源');
    }

    if (dto.paperId) {
      const paper = await this.prisma.task.findUnique({
        where: { id: dto.paperId },
        select: { id: true, userId: true },
      });
      if (!paper) throw new NotFoundException('论文不存在');
      if (paper.userId !== userId)
        throw new ForbiddenException('无权访问该资源');
    }

    const sourceType = dto.polishTaskId ? 'polish' : 'paper';

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const created = await this.prisma.exportTask.create({
      data: {
        userId,
        paperId: dto.paperId ?? null,
        polishTaskId: dto.polishTaskId ?? null,
        sourceType,
        format: dto.format ?? undefined,
        scope: dto.scope,
        template: dto.template ?? undefined,
        title: dto.title,
        author: dto.author ?? null,
        school: dto.school ?? null,
        major: dto.major ?? null,
        studentId: dto.studentId ?? null,
        advisor: dto.advisor ?? null,
        abstract: dto.abstract ?? null,
        keywords: dto.keywords ? dto.keywords.join(',') : null,
        status: ExportStatus.PENDING,
        progress: 0,
        expiresAt,
      },
    });

    this.queue.enqueue(created.id);
    return this.toResult(created);
  }

  async findAll(userId: string, query: QueryExportDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { userId };
    if (query.status) where.status = query.status;
    if (query.template) where.template = query.template;

    const [items, total] = await Promise.all([
      this.prisma.exportTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.exportTask.count({ where }),
    ]);

    return {
      items: items.map((x) => this.toResult(x)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(userId: string, id: string): Promise<ExportResultDto> {
    const task = await this.prisma.exportTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.userId !== userId) throw new ForbiddenException('无权访问该任务');
    return this.toResult(task);
  }

  async getDownloadInfo(userId: string, id: string) {
    const task = await this.prisma.exportTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.userId !== userId) throw new ForbiddenException('无权访问该任务');

    if (task.status === ExportStatus.EXPIRED) {
      throw new BadRequestException('文件已过期');
    }

    if (task.status !== ExportStatus.SUCCESS) {
      throw new BadRequestException('导出尚未完成，无法下载');
    }

    const now = new Date();
    if (task.expiresAt && task.expiresAt.getTime() < now.getTime()) {
      throw new BadRequestException('文件已过期');
    }

    if (!task.filePath) {
      throw new BadRequestException('文件已丢失，请重新导出');
    }

    try {
      await fs.promises.stat(task.filePath);
    } catch {
      throw new BadRequestException('文件已丢失，请重新导出');
    }

    const updated = await this.prisma.exportTask.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
      select: { filePath: true, fileName: true },
    });

    return {
      filePath: updated.filePath ?? task.filePath,
      fileName: updated.fileName ?? task.fileName ?? 'export.docx',
    };
  }

  async retry(userId: string, id: string): Promise<ExportResultDto> {
    const task = await this.prisma.exportTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.userId !== userId) throw new ForbiddenException('无权访问该任务');
    if (task.status !== ExportStatus.FAILED) {
      throw new BadRequestException('仅失败任务可重试');
    }

    const updated = await this.prisma.exportTask.update({
      where: { id },
      data: {
        status: ExportStatus.PENDING,
        progress: 0,
        errorMessage: null,
        filePath: null,
        fileName: null,
        fileSize: null,
      },
    });

    this.queue.enqueue(id);
    return this.toResult(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    const task = await this.prisma.exportTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.userId !== userId) throw new ForbiddenException('无权访问该任务');

    await deleteFileIfExists(task.filePath);
    await this.prisma.exportTask.delete({ where: { id } });
  }

  async *streamProgress(
    userId: string,
    id: string,
  ): AsyncIterable<{
    status: ExportStatus;
    progress: number;
    errorMessage: string | null;
  }> {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= 10 * 60_000) {
      const task = await this.prisma.exportTask.findUnique({
        where: { id },
        select: {
          userId: true,
          status: true,
          progress: true,
          errorMessage: true,
        },
      });
      if (!task) throw new NotFoundException('任务不存在');
      if (task.userId !== userId)
        throw new ForbiddenException('无权访问该任务');

      yield {
        status: task.status,
        progress: task.progress,
        errorMessage: task.errorMessage ?? null,
      };

      if (
        task.status === ExportStatus.SUCCESS ||
        task.status === ExportStatus.FAILED ||
        task.status === ExportStatus.EXPIRED
      ) {
        return;
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    const tasks = await this.prisma.exportTask.findMany({
      where: {
        status: ExportStatus.SUCCESS,
        expiresAt: { lt: now },
      },
      select: { id: true, filePath: true },
    });

    let cleaned = 0;
    for (const t of tasks) {
      try {
        await deleteFileIfExists(t.filePath);
        await this.prisma.exportTask.update({
          where: { id: t.id },
          data: { status: ExportStatus.EXPIRED, filePath: null },
        });
        cleaned += 1;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`清理任务失败 id=${t.id}: ${message}`);
      }
    }

    return cleaned;
  }

  private toResult(task: {
    id: string;
    status: ExportStatus;
    progress: number;
    fileName: string | null;
    fileSize: number | null;
    downloadCount: number;
    createdAt: Date;
    expiresAt: Date | null;
    errorMessage: string | null;
  }): ExportResultDto {
    return {
      id: task.id,
      status: task.status,
      progress: task.progress,
      fileName: task.fileName ?? null,
      fileSize: task.fileSize ?? null,
      downloadCount: task.downloadCount,
      createdAt: task.createdAt,
      expiresAt: task.expiresAt ?? null,
      errorMessage: task.errorMessage ?? null,
    };
  }
}
