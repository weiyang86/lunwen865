import { BadRequestException, Injectable } from '@nestjs/common';
import {
  QuotaChangeReason,
  QuotaType,
  type Prisma,
  type Prisma as PrismaTypes,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GrantQuotaDto } from './dto/grant-quota.dto';
import { QueryQuotaLogDto } from './dto/query-quota-log.dto';
import { QuotaService } from './quota.service';

@Injectable()
export class AdminQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: QuotaService,
  ) {}

  async getUserQuota(userId: string, type?: QuotaType) {
    if (!userId) throw new BadRequestException('请提供 userId');
    if (type) {
      const balance = await this.quotaService.getBalance(userId, type);
      return { userId, type, balance };
    }
    const balances = await this.quotaService.getAllBalances(userId);
    return { userId, balances };
  }

  async grant(dto: GrantQuotaDto): Promise<void> {
    await this.quotaService.grant({
      userId: dto.userId,
      type: dto.type,
      amount: dto.amount,
      reason: QuotaChangeReason.ADMIN_GRANT,
      remark: dto.remark,
    });
  }

  async deduct(dto: GrantQuotaDto): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.userQuota.updateMany({
        where: {
          userId: dto.userId,
          quotaType: dto.type,
          balance: { gte: dto.amount },
        },
        data: {
          balance: { decrement: dto.amount },
          totalOut: { increment: dto.amount },
        },
      });

      if (updated.count === 0) {
        const q = await tx.userQuota.findUnique({
          where: {
            userId_quotaType: { userId: dto.userId, quotaType: dto.type },
          },
          select: { balance: true },
        });
        throw new BadRequestException(
          `配额不足，当前余额 ${q?.balance ?? 0}，需要 ${dto.amount}`,
        );
      }

      const q2 = await tx.userQuota.findUnique({
        where: {
          userId_quotaType: { userId: dto.userId, quotaType: dto.type },
        },
        select: { balance: true },
      });

      await tx.quotaLog.create({
        data: {
          userId: dto.userId,
          quotaType: dto.type,
          change: -dto.amount,
          balanceAfter: q2?.balance ?? 0,
          reason: QuotaChangeReason.ADMIN_DEDUCT,
          remark: dto.remark ?? null,
        },
        select: { id: true },
      });
    });
  }

  async findLogs(query: QueryQuotaLogDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.QuotaLogWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.type) where.quotaType = query.type;
    if (query.reason) where.reason = query.reason;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate)
        (where.createdAt as PrismaTypes.DateTimeFilter).gte = new Date(
          query.startDate,
        );
      if (query.endDate)
        (where.createdAt as PrismaTypes.DateTimeFilter).lte = new Date(
          query.endDate,
        );
    }

    const [items, total] = await Promise.all([
      this.prisma.quotaLog.findMany({
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
      this.prisma.quotaLog.count({ where }),
    ]);

    return {
      items: items.map((x) => ({
        ...x,
        user: {
          id: x.user.id,
          username:
            x.user.nickname ?? x.user.email ?? x.user.phone ?? x.user.id,
        },
      })),
      total,
      page,
      pageSize,
    };
  }

  async getStats() {
    const [rechargeCount, consumeCount, topRaw] = await Promise.all([
      this.prisma.quotaLog.count({ where: { change: { gt: 0 } } }),
      this.prisma.quotaLog.count({
        where: { reason: QuotaChangeReason.CONSUME },
      }),
      this.prisma.quotaLog.groupBy({
        by: ['userId'],
        where: { reason: QuotaChangeReason.CONSUME },
        orderBy: { userId: 'asc' },
        _sum: { change: true },
        _count: { _all: true },
      }),
    ]);

    const top = (
      topRaw as Array<{
        userId: string;
        _sum: { change: number | null };
        _count: { _all: number };
      }>
    )
      .map((x) => ({
        userId: x.userId,
        consumeCount: x._count._all,
        consumeAmount: Math.abs(x._sum.change ?? 0),
      }))
      .sort(
        (a, b) =>
          b.consumeAmount - a.consumeAmount || b.consumeCount - a.consumeCount,
      )
      .slice(0, 10);

    const users = top.length
      ? await this.prisma.user.findMany({
          where: { id: { in: top.map((x) => x.userId) } },
          select: { id: true, nickname: true, email: true, phone: true },
        })
      : [];

    const userMap = new Map(
      users.map((u) => [u.id, u.nickname ?? u.email ?? u.phone ?? u.id]),
    );

    return {
      totalRechargeCount: rechargeCount,
      totalConsumeCount: consumeCount,
      topUsers: top.map((x) => ({
        userId: x.userId,
        username: userMap.get(x.userId) ?? x.userId,
        consumeCount: x.consumeCount,
        consumeAmount: x.consumeAmount,
      })),
    };
  }
}
