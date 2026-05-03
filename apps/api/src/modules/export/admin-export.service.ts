import { Injectable } from '@nestjs/common';
import { ExportStatus, type ExportTemplate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { deleteFileIfExists } from './utils/cleanup.util';
import type { QueryExportDto } from './dto/query-export.dto';

@Injectable()
export class AdminExportService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryExportDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.template) where.template = query.template;

    const [items, total] = await Promise.all([
      this.prisma.exportTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: {
            select: { id: true, nickname: true, email: true, phone: true },
          },
        },
      }),
      this.prisma.exportTask.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        ...t,
        user: {
          id: t.user.id,
          username:
            t.user.nickname ?? t.user.email ?? t.user.phone ?? t.user.id,
        },
      })),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string) {
    return this.prisma.exportTask.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, nickname: true, email: true, phone: true },
        },
      },
    });
  }

  async getStats() {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const [
      total,
      byStatusRaw,
      byTemplateRaw,
      topUsersRaw,
      successTimes,
      todayCount,
      weekCount,
    ] = await Promise.all([
      this.prisma.exportTask.count(),
      this.prisma.exportTask.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.exportTask.groupBy({
        by: ['template'],
        orderBy: { template: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.exportTask.groupBy({
        by: ['userId'],
        orderBy: { userId: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.exportTask.findMany({
        where: { status: ExportStatus.SUCCESS },
        select: { createdAt: true, updatedAt: true },
      }),
      this.prisma.exportTask.count({ where: { createdAt: { gte: dayStart } } }),
      this.prisma.exportTask.count({
        where: { createdAt: { gte: weekStart } },
      }),
    ]);

    const byStatus: Record<string, number> = {
      PENDING: 0,
      PROCESSING: 0,
      SUCCESS: 0,
      FAILED: 0,
      EXPIRED: 0,
    };

    for (const g of byStatusRaw as Array<{
      status: string;
      _count: { _all: number };
    }>) {
      byStatus[String(g.status)] = Number(g._count._all ?? 0);
    }

    const byTemplate: Record<string, number> = {
      GENERIC: 0,
      UNDERGRADUATE: 0,
      MASTER: 0,
      CUSTOM: 0,
    };

    for (const g of byTemplateRaw as Array<{
      template: ExportTemplate;
      _count: { _all: number };
    }>) {
      byTemplate[String(g.template)] = Number(g._count._all ?? 0);
    }

    const avgDurationMs =
      successTimes.length === 0
        ? 0
        : Math.round(
            successTimes.reduce(
              (sum, t) => sum + (t.updatedAt.getTime() - t.createdAt.getTime()),
              0,
            ) / successTimes.length,
          );

    const sortedUsers = (
      topUsersRaw as Array<{ userId: string; _count: { _all: number } }>
    )
      .map((x) => ({ userId: x.userId, count: Number(x._count._all ?? 0) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const users = sortedUsers.length
      ? await this.prisma.user.findMany({
          where: { id: { in: sortedUsers.map((x) => x.userId) } },
          select: { id: true, nickname: true, email: true, phone: true },
        })
      : [];
    const userMap = new Map(
      users.map((u) => [u.id, u.nickname ?? u.email ?? u.phone ?? u.id]),
    );

    const topUsers = sortedUsers.map((x) => ({
      userId: x.userId,
      username: userMap.get(x.userId) ?? x.userId,
      count: x.count,
    }));

    return {
      total,
      byStatus,
      byTemplate,
      topUsers,
      avgDurationMs,
      todayCount,
      weekCount,
    };
  }

  async forceDelete(id: string): Promise<void> {
    const task = await this.prisma.exportTask.findUnique({
      where: { id },
      select: { id: true, filePath: true },
    });
    if (!task) return;
    await deleteFileIfExists(task.filePath);
    await this.prisma.exportTask.delete({ where: { id } });
  }
}
