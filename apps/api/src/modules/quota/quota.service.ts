import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  QuotaChangeReason,
  QuotaType,
  type Prisma as PrismaTypes,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryQuotaLogDto } from './dto/query-quota-log.dto';

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string, type: QuotaType): Promise<number> {
    const q = await this.prisma.userQuota.findUnique({
      where: { userId_quotaType: { userId, quotaType: type } },
      select: { balance: true },
    });
    return q?.balance ?? 0;
  }

  async getAllBalances(userId: string): Promise<Record<QuotaType, number>> {
    const rows = await this.prisma.userQuota.findMany({
      where: { userId },
      select: { quotaType: true, balance: true },
    });

    const result: Record<QuotaType, number> = {
      [QuotaType.PAPER_GENERATION]: 0,
      [QuotaType.POLISH]: 0,
      [QuotaType.EXPORT]: 0,
      [QuotaType.AI_CHAT]: 0,
    };

    for (const r of rows) {
      result[r.quotaType] = r.balance;
    }
    return result;
  }

  async grant(params: {
    userId: string;
    type: QuotaType;
    amount: number;
    reason: QuotaChangeReason;
    orderId?: string;
    remark?: string;
    tx?: PrismaTypes.TransactionClient;
  }): Promise<void> {
    if (params.amount <= 0) throw new BadRequestException('配额数量必须大于 0');

    const exec = async (db: PrismaTypes.TransactionClient) => {
      const q = await db.userQuota.upsert({
        where: {
          userId_quotaType: { userId: params.userId, quotaType: params.type },
        },
        create: {
          userId: params.userId,
          quotaType: params.type,
          balance: params.amount,
          totalIn: params.amount,
        },
        update: {
          balance: { increment: params.amount },
          totalIn: { increment: params.amount },
        },
        select: { balance: true },
      });

      await db.quotaLog.create({
        data: {
          userId: params.userId,
          quotaType: params.type,
          change: params.amount,
          balanceAfter: q.balance,
          reason: params.reason,
          orderId: params.orderId ?? null,
          remark: params.remark ?? null,
        },
        select: { id: true },
      });
    };

    if (params.tx) await exec(params.tx);
    else await this.prisma.$transaction(exec);
  }

  async consume(params: {
    userId: string;
    type: QuotaType;
    amount: number;
    bizId?: string;
    remark?: string;
    tx?: PrismaTypes.TransactionClient;
  }): Promise<void> {
    if (params.amount <= 0) throw new BadRequestException('扣除数量必须大于 0');

    const exec = async (tx: PrismaTypes.TransactionClient) => {
      if (params.bizId) {
        const existed = await tx.quotaLog.findFirst({
          where: {
            userId: params.userId,
            quotaType: params.type,
            reason: QuotaChangeReason.CONSUME,
            bizId: params.bizId,
          },
          select: { id: true },
        });
        if (existed) return;
      }

      const updatedCount = await tx.userQuota.updateMany({
        where: {
          userId: params.userId,
          quotaType: params.type,
          balance: { gte: params.amount },
        },
        data: {
          balance: { decrement: params.amount },
          totalOut: { increment: params.amount },
        },
      });

      if (updatedCount.count === 0) {
        const q = await tx.userQuota.findUnique({
          where: {
            userId_quotaType: { userId: params.userId, quotaType: params.type },
          },
          select: { balance: true },
        });
        throw new BadRequestException(
          `配额不足，当前余额 ${q?.balance ?? 0}，需要 ${params.amount}`,
        );
      }

      const q2 = await tx.userQuota.findUnique({
        where: {
          userId_quotaType: { userId: params.userId, quotaType: params.type },
        },
        select: { balance: true },
      });
      const balanceAfter = q2?.balance ?? 0;

      await tx.quotaLog.create({
        data: {
          userId: params.userId,
          quotaType: params.type,
          change: -params.amount,
          balanceAfter,
          reason: QuotaChangeReason.CONSUME,
          bizId: params.bizId ?? null,
          remark: params.remark ?? null,
        },
        select: { id: true },
      });
    };

    if (params.tx) await exec(params.tx);
    else await this.prisma.$transaction(exec);
  }

  async refund(params: {
    userId: string;
    type: QuotaType;
    amount: number;
    orderId: string;
    tx?: PrismaTypes.TransactionClient;
  }): Promise<void> {
    if (params.amount <= 0) throw new BadRequestException('配额数量必须大于 0');

    const exec = async (tx: PrismaTypes.TransactionClient) => {
      const q = await tx.userQuota.upsert({
        where: {
          userId_quotaType: { userId: params.userId, quotaType: params.type },
        },
        create: {
          userId: params.userId,
          quotaType: params.type,
          balance: -params.amount,
          totalOut: params.amount,
        },
        update: {
          balance: { decrement: params.amount },
          totalOut: { increment: params.amount },
        },
        select: { balance: true },
      });

      await tx.quotaLog.create({
        data: {
          userId: params.userId,
          quotaType: params.type,
          change: -params.amount,
          balanceAfter: q.balance,
          reason: QuotaChangeReason.REFUND,
          orderId: params.orderId,
        },
        select: { id: true },
      });
    };

    if (params.tx) await exec(params.tx);
    else await this.prisma.$transaction(exec);
  }

  async findLogs(userId: string, query: QueryQuotaLogDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.QuotaLogWhereInput = { userId };
    if (query.type) where.quotaType = query.type;
    if (query.reason) where.reason = query.reason;

    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.quotaLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.quotaLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async ensure(userId: string, type: QuotaType, amount: number): Promise<void> {
    const balance = await this.getBalance(userId, type);
    if (balance < amount) {
      throw new BadRequestException(
        `${this.typeLabel(type)}配额不足，当前 ${balance}，需要 ${amount}`,
      );
    }
  }

  private typeLabel(type: QuotaType): string {
    return (
      {
        PAPER_GENERATION: '论文生成',
        POLISH: '润色',
        EXPORT: '导出',
        AI_CHAT: 'AI 对话',
      }[type] ?? '未知'
    );
  }
}
