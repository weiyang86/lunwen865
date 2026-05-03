import { Injectable } from '@nestjs/common';
import { PolishStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { QueryPolishDto } from './dto/query-polish.dto';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable()
export class AdminPolishService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryPolishDto & { userId?: string }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.PolishTaskWhereInput = {};

    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;
    if (query.strength) where.strength = query.strength;
    if (query.keyword) {
      where.title = { contains: query.keyword, mode: 'insensitive' };
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.polishTask.count({ where }),
      this.prisma.polishTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              email: true,
              nickname: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    return this.prisma.polishTask.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            email: true,
            nickname: true,
            role: true,
          },
        },
        segments: { orderBy: { segmentIndex: 'asc' } },
      },
    });
  }

  async getGlobalStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysStart = startOfDay(sevenDaysAgo);

    const [totalTasks, statusGroupsRaw, monthSum, last7, topUsersRaw] =
      await this.prisma.$transaction([
        this.prisma.polishTask.count(),
        this.prisma.polishTask.groupBy({
          by: ['status'],
          orderBy: { status: 'asc' },
          _count: { _all: true },
        }),
        this.prisma.polishTask.aggregate({
          where: {
            status: PolishStatus.SUCCESS,
            createdAt: { gte: monthStart },
          },
          _sum: { wordsCharged: true },
        }),
        this.prisma.polishTask.findMany({
          where: { createdAt: { gte: sevenDaysStart } },
          select: { createdAt: true, status: true, wordsCharged: true },
        }),
        this.prisma.polishTask.groupBy({
          by: ['userId'],
          where: { status: PolishStatus.SUCCESS },
          _sum: { wordsCharged: true },
          orderBy: { _sum: { wordsCharged: 'desc' } },
          take: 10,
        }),
      ]);

    const statusGroups = statusGroupsRaw as Array<{
      status: PolishStatus;
      _count: { _all: number };
    }>;
    const topUsers = topUsersRaw as Array<{
      userId: string;
      _sum: { wordsCharged: number | null };
    }>;

    const byStatus: Record<string, number> = {};
    for (const g of statusGroups) {
      byStatus[String(g.status)] = Number(g._count._all ?? 0);
    }

    const trend: Record<
      string,
      { total: number; success: number; failed: number }
    > = {};
    for (let i = 0; i < 7; i += 1) {
      const d = startOfDay(
        new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000),
      );
      trend[formatYmd(d)] = { total: 0, success: 0, failed: 0 };
    }
    for (const x of last7) {
      const key = formatYmd(startOfDay(x.createdAt));
      if (!(key in trend)) continue;
      trend[key].total += 1;
      if (x.status === PolishStatus.SUCCESS) trend[key].success += 1;
      if (x.status === PolishStatus.FAILED) trend[key].failed += 1;
    }

    const topUserIds = topUsers.map((x) => x.userId);
    const users =
      topUserIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: topUserIds } },
            select: { id: true, email: true, phone: true, nickname: true },
          });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const top10UsersByWords = topUsers.map((x) => ({
      userId: x.userId,
      wordsCharged: Number(x._sum.wordsCharged ?? 0),
      user: userMap.get(x.userId) ?? null,
    }));

    return {
      totalTasks,
      byStatus,
      monthWordsCharged: Number(monthSum._sum.wordsCharged ?? 0),
      last7DaysTrend: trend,
      top10UsersByWords,
    };
  }
}
