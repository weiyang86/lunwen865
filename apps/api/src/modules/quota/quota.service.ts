import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  QuotaChangeReason,
  QuotaType,
  type Prisma as PrismaTypes,
} from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { QueryQuotaLogDto } from './dto/query-quota-log.dto';

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

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
      [QuotaType.BRAIN_CELL]: 0,
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

  async ensureOrExchangeFromBrainCell(
    userId: string,
    targetType: QuotaType,
    amount: number,
  ): Promise<void> {
    if (amount <= 0) return;
    if (targetType === QuotaType.BRAIN_CELL) {
      await this.ensure(userId, QuotaType.BRAIN_CELL, amount);
      return;
    }

    const current = await this.getBalance(userId, targetType);
    if (current >= amount) return;

    const deficit = amount - current;
    const brainCellBalance = await this.getBalance(
      userId,
      QuotaType.BRAIN_CELL,
    );
    const rates = await this.getExchangeRates();
    const rate =
      targetType === QuotaType.PAPER_GENERATION
        ? rates.paperGeneration
        : targetType === QuotaType.POLISH
          ? rates.polish
          : targetType === QuotaType.EXPORT
            ? rates.export
            : targetType === QuotaType.AI_CHAT
              ? rates.aiChat
              : null;

    const cost = rate ? deficit * rate : 0;
    throw new BadRequestException(
      `${this.typeLabel(targetType)}配额不足，当前 ${current}，需要 ${amount}。可使用脑细胞兑换：缺少 ${deficit} 次，需要 ${cost} 脑细胞，当前脑细胞 ${brainCellBalance}。`,
    );
  }

  async exchangeFromBrainCell(params: {
    userId: string;
    targetType: QuotaType;
    amount: number;
    remark?: string;
    tx?: PrismaTypes.TransactionClient;
  }): Promise<void> {
    if (params.amount <= 0) throw new BadRequestException('兑换数量必须大于 0');
    if (params.targetType === QuotaType.BRAIN_CELL) {
      throw new BadRequestException('不支持兑换为脑细胞');
    }

    const rates = await this.getExchangeRates();
    const rate =
      params.targetType === QuotaType.PAPER_GENERATION
        ? rates.paperGeneration
        : params.targetType === QuotaType.POLISH
          ? rates.polish
          : params.targetType === QuotaType.EXPORT
            ? rates.export
            : params.targetType === QuotaType.AI_CHAT
              ? rates.aiChat
              : null;

    if (!rate || rate <= 0) {
      throw new BadRequestException('兑换比例配置异常');
    }

    const brainCellCost = params.amount * rate;
    const bizId = `EXCHANGE_${Date.now()}_${crypto.randomUUID()}`;

    const exec = async (tx: PrismaTypes.TransactionClient) => {
      const updated = await tx.userQuota.updateMany({
        where: {
          userId: params.userId,
          quotaType: QuotaType.BRAIN_CELL,
          balance: { gte: brainCellCost },
        },
        data: {
          balance: { decrement: brainCellCost },
          totalOut: { increment: brainCellCost },
        },
      });
      if (updated.count === 0) {
        const q = await tx.userQuota.findUnique({
          where: {
            userId_quotaType: {
              userId: params.userId,
              quotaType: QuotaType.BRAIN_CELL,
            },
          },
          select: { balance: true },
        });
        throw new BadRequestException(
          `脑细胞不足，当前余额 ${q?.balance ?? 0}，需要 ${brainCellCost}`,
        );
      }

      const brainAfter = await tx.userQuota.findUnique({
        where: {
          userId_quotaType: {
            userId: params.userId,
            quotaType: QuotaType.BRAIN_CELL,
          },
        },
        select: { balance: true },
      });

      const targetAfter = await tx.userQuota.upsert({
        where: {
          userId_quotaType: {
            userId: params.userId,
            quotaType: params.targetType,
          },
        },
        create: {
          userId: params.userId,
          quotaType: params.targetType,
          balance: params.amount,
          totalIn: params.amount,
        },
        update: {
          balance: { increment: params.amount },
          totalIn: { increment: params.amount },
        },
        select: { balance: true },
      });

      await tx.quotaLog.createMany({
        data: [
          {
            userId: params.userId,
            quotaType: QuotaType.BRAIN_CELL,
            change: -brainCellCost,
            balanceAfter: brainAfter?.balance ?? 0,
            reason: QuotaChangeReason.EXCHANGE,
            bizId,
            remark:
              params.remark ??
              `兑换 ${this.typeLabel(params.targetType)} x${params.amount}`,
          },
          {
            userId: params.userId,
            quotaType: params.targetType,
            change: params.amount,
            balanceAfter: targetAfter.balance,
            reason: QuotaChangeReason.EXCHANGE,
            bizId,
            remark:
              params.remark ??
              `使用脑细胞兑换 ${this.typeLabel(params.targetType)} x${params.amount}`,
          },
        ],
      });
    };

    if (params.tx) await exec(params.tx);
    else await this.prisma.$transaction(exec);
  }

  async getExchangeRates(): Promise<{
    paperGeneration: number;
    polish: number;
    export: number;
    aiChat: number;
  }> {
    const site = await this.settings.getSiteSettings();
    const r = site.exchangeRates;
    return {
      paperGeneration: Math.max(1, Math.trunc(r.paperGeneration)),
      polish: Math.max(1, Math.trunc(r.polish)),
      export: Math.max(1, Math.trunc(r.export)),
      aiChat: Math.max(1, Math.trunc(r.aiChat)),
    };
  }

  private typeLabel(type: QuotaType): string {
    return (
      {
        BRAIN_CELL: '脑细胞',
        PAPER_GENERATION: '论文生成',
        POLISH: '润色',
        EXPORT: '导出',
        AI_CHAT: 'AI 对话',
      }[type] ?? '未知'
    );
  }
}
