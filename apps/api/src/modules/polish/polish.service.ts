import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PolishMode, PolishStatus, Prisma, QuotaType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { PolishQueue } from './polish.queue';
import type { CreatePolishDto } from './dto/create-polish.dto';
import type { QueryPolishDto } from './dto/query-polish.dto';
import type {
  PolishDiffResultDto,
  PolishSegmentDiffDto,
  PolishStatsDto,
} from './dto/polish-result.dto';
import { QuotaService } from '../quota/quota.service';

function isTerminal(status: PolishStatus): boolean {
  return (
    status === PolishStatus.SUCCESS ||
    status === PolishStatus.FAILED ||
    status === PolishStatus.CANCELLED
  );
}

function countChargedWords(text: string): number {
  const raw = text ?? '';
  const cjkCount = (raw.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const enWords = (raw.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []).length;
  return cjkCount + enWords;
}

function truncateForDiff(text: string, maxLen: number): string {
  const raw = text ?? '';
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen);
}

function lcsLength(a: string, b: string): number {
  if (!a || !b) return 0;
  const n = a.length;
  const m = b.length;
  const dp = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i += 1) {
    let prev = 0;
    for (let j = 1; j <= m; j += 1) {
      const temp = dp[j] ?? 0;
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev + 1;
      } else {
        dp[j] = Math.max(dp[j] ?? 0, dp[j - 1] ?? 0);
      }
      prev = temp;
    }
  }
  return dp[m] ?? 0;
}

function calcChangeRatio(a: string, b: string): number {
  const aa = truncateForDiff(a, 1000);
  const bb = truncateForDiff(b, 1000);
  const maxLen = Math.max(aa.length, bb.length);
  if (maxLen === 0) return 0;
  const lcs = lcsLength(aa, bb);
  const edits = maxLen - lcs;
  return Math.min(Math.max(edits / maxLen, 0), 1);
}

@Injectable()
export class PolishService {
  private readonly logger = new Logger(PolishService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly queue: PolishQueue,
    private readonly quotaService: QuotaService,
  ) {}

  async create(userId: string, dto: CreatePolishDto) {
    await this.quotaService.ensure(userId, QuotaType.POLISH, 1);
    const raw = (dto.text ?? '').trim();
    if (raw.length < 50) throw new BadRequestException('文本至少 50 字');
    if (raw.length > 20000)
      throw new BadRequestException('文本不能超过 20000 字');

    const words = countChargedWords(raw);
    const ok = await this.userService.checkQuota(userId, words);
    if (!ok) throw new ForbiddenException('字数额度不足，请充值后再试');

    const mode = dto.mode ?? PolishMode.BALANCED;
    const preserveQuotes = dto.preserveQuotes ?? true;
    const preserveTerms = dto.preserveTerms ?? [];

    this.logger.log(
      `create userId=${userId} words=${words} strength=${dto.strength} mode=${mode}`,
    );

    const created = await this.prisma.polishTask.create({
      data: {
        userId,
        taskId: dto.taskId ?? null,
        title: dto.title ?? null,
        originalText: raw,
        originalLength: words,
        strength: dto.strength,
        mode,
        preserveQuotes,
        preserveTerms,
        status: PolishStatus.PENDING,
        progress: 0,
        wordsCharged: words,
      },
    });

    this.queue.enqueue(created.id);
    return created;
  }

  async findAll(userId: string, query: QueryPolishDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.PolishTaskWhereInput = { userId };

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
        select: {
          id: true,
          title: true,
          status: true,
          progress: true,
          strength: true,
          mode: true,
          originalLength: true,
          polishedLength: true,
          aiScoreBefore: true,
          aiScoreAfter: true,
          wordsCharged: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
        },
      }),
    ]);

    return { data: items, total, page, pageSize };
  }

  async findOne(userId: string, id: string) {
    const task = await this.prisma.polishTask.findUnique({
      where: { id },
      include: { segments: { orderBy: { segmentIndex: 'asc' } } },
    });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.userId !== userId) throw new ForbiddenException('无权访问该任务');
    return task;
  }

  async cancel(userId: string, id: string) {
    const task = await this.prisma.polishTask.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.userId !== userId) throw new ForbiddenException('无权访问该任务');

    if (
      task.status !== PolishStatus.PENDING &&
      task.status !== PolishStatus.PROCESSING
    ) {
      throw new BadRequestException('当前状态不可取消');
    }

    this.logger.log(`cancel userId=${userId} id=${id}`);

    const updated = await this.prisma.polishTask.update({
      where: { id },
      data: {
        status: PolishStatus.CANCELLED,
        errorMessage: '用户取消',
        completedAt: new Date(),
      },
    });

    await this.prisma.polishSegment.updateMany({
      where: {
        polishTaskId: id,
        status: { in: [PolishStatus.PENDING, PolishStatus.PROCESSING] },
      },
      data: { status: PolishStatus.CANCELLED },
    });

    return updated;
  }

  async retry(userId: string, id: string) {
    const task = await this.prisma.polishTask.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, originalText: true },
    });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.userId !== userId) throw new ForbiddenException('无权访问该任务');
    if (task.status !== PolishStatus.FAILED) {
      throw new BadRequestException('仅 FAILED 任务可重试');
    }

    this.logger.log(`retry userId=${userId} id=${id}`);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.polishSegment.deleteMany({ where: { polishTaskId: id } });
      return tx.polishTask.update({
        where: { id },
        data: {
          status: PolishStatus.PENDING,
          progress: 0,
          errorMessage: null,
          polishedText: null,
          polishedLength: null,
          aiScoreBefore: null,
          aiScoreAfter: null,
          tokensConsumed: null,
          modelUsed: null,
          startedAt: null,
          completedAt: null,
        },
      });
    });

    this.queue.enqueue(id);
    return updated;
  }

  async delete(userId: string, id: string): Promise<void> {
    const task = await this.prisma.polishTask.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.userId !== userId) throw new ForbiddenException('无权访问该任务');
    if (!isTerminal(task.status))
      throw new BadRequestException('仅终态任务可删除');

    this.logger.log(`delete userId=${userId} id=${id}`);
    await this.prisma.polishTask.delete({ where: { id } });
  }

  async getDiff(userId: string, id: string): Promise<PolishDiffResultDto> {
    const task = await this.prisma.polishTask.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        aiScoreBefore: true,
        aiScoreAfter: true,
      },
    });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.userId !== userId) throw new ForbiddenException('无权访问该任务');
    if (task.status !== PolishStatus.SUCCESS)
      throw new BadRequestException('任务未完成，无法获取对比');

    const segments = await this.prisma.polishSegment.findMany({
      where: { polishTaskId: id },
      orderBy: { segmentIndex: 'asc' },
      select: {
        segmentIndex: true,
        originalText: true,
        polishedText: true,
      },
    });

    const diffs: PolishSegmentDiffDto[] = segments.map((s) => {
      const polished = s.polishedText ?? '';
      return {
        index: s.segmentIndex,
        original: s.originalText,
        polished,
        changeRatio: calcChangeRatio(s.originalText, polished),
      };
    });

    const avg =
      diffs.length > 0
        ? diffs.reduce((acc, x) => acc + x.changeRatio, 0) / diffs.length
        : 0;

    return {
      taskId: id,
      totalSegments: diffs.length,
      avgChangeRatio: Number(avg.toFixed(4)),
      aiScoreBefore: task.aiScoreBefore ?? null,
      aiScoreAfter: task.aiScoreAfter ?? null,
      segments: diffs,
    };
  }

  async getStats(userId: string): Promise<PolishStatsDto> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalTasks,
      successTasks,
      failedTasks,
      totals,
      monthTotals,
      byStrengthRaw,
    ] = await this.prisma.$transaction([
      this.prisma.polishTask.count({ where: { userId } }),
      this.prisma.polishTask.count({
        where: { userId, status: PolishStatus.SUCCESS },
      }),
      this.prisma.polishTask.count({
        where: { userId, status: PolishStatus.FAILED },
      }),
      this.prisma.polishTask.aggregate({
        where: { userId, status: PolishStatus.SUCCESS },
        _sum: { wordsCharged: true },
        _avg: { aiScoreBefore: true, aiScoreAfter: true },
      }),
      this.prisma.polishTask.aggregate({
        where: {
          userId,
          status: PolishStatus.SUCCESS,
          createdAt: { gte: monthStart },
        },
        _sum: { wordsCharged: true },
      }),
      this.prisma.polishTask.groupBy({
        by: ['strength'],
        orderBy: { strength: 'asc' },
        where: { userId },
        _count: { _all: true },
      }),
    ]);

    const avgAiScoreReduction =
      totals._avg.aiScoreBefore !== null &&
      totals._avg.aiScoreBefore !== undefined &&
      totals._avg.aiScoreAfter !== null &&
      totals._avg.aiScoreAfter !== undefined
        ? Number(
            (totals._avg.aiScoreBefore - totals._avg.aiScoreAfter).toFixed(2),
          )
        : 0;

    const mapStrength: Record<string, number> = {};
    const byStrength = byStrengthRaw as Array<{
      strength: string;
      _count: { _all: number };
    }>;
    for (const g of byStrength) {
      mapStrength[String(g.strength)] = Number(g._count._all ?? 0);
    }

    return {
      totalTasks,
      successTasks,
      failedTasks,
      totalWordsProcessed: Number(totals._sum.wordsCharged ?? 0),
      totalWordsThisMonth: Number(monthTotals._sum.wordsCharged ?? 0),
      avgAiScoreReduction,
      byStrength: mapStrength,
    };
  }

  async *streamProgress(
    userId: string,
    id: string,
  ): AsyncIterable<{
    status: PolishStatus;
    progress: number;
    errorMessage: string | null;
  }> {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= 10 * 60_000) {
      const task = await this.prisma.polishTask.findUnique({
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

      if (isTerminal(task.status)) return;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
