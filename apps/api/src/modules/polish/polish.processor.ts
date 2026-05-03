import { Injectable, Logger } from '@nestjs/common';
import {
  PolishMode,
  PolishStatus,
  PolishStrength,
  QuotaType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { PromptService } from '../prompt/prompt.service';
import { UserService } from '../user/user.service';
import { QuotaService } from '../quota/quota.service';
import { AiDetectorService } from './detector/ai-detector.service';
import { buildPolishSystemPrompt } from './prompts/system-prompts';
import { postProcess } from './strategies/post-processor';
import { PlaceholderManager } from './strategies/placeholder';
import { segmentText } from './strategies/segmenter';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countChargedWords(text: string): number {
  const raw = (text ?? '').replace(/\s+/g, '');
  return raw.length;
}

function isTerminal(status: PolishStatus): boolean {
  return (
    status === PolishStatus.SUCCESS ||
    status === PolishStatus.FAILED ||
    status === PolishStatus.CANCELLED
  );
}

@Injectable()
export class PolishProcessor {
  private readonly logger = new Logger(PolishProcessor.name);
  private readonly taskTimeoutMs = 10 * 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly promptService: PromptService,
    private readonly detector: AiDetectorService,
    private readonly userService: UserService,
    private readonly quotaService: QuotaService,
  ) {}

  async process(polishTaskId: string): Promise<void> {
    const timeout = new Promise<void>((_, reject) => {
      setTimeout(
        () => reject(new Error('Polish task timeout')),
        this.taskTimeoutMs,
      );
    });
    await Promise.race([this.processInternal(polishTaskId), timeout]).catch(
      async (error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        await this.prisma.polishTask.update({
          where: { id: polishTaskId },
          data: {
            status: PolishStatus.FAILED,
            errorMessage: message,
            completedAt: new Date(),
          },
        });
      },
    );
  }

  private async processInternal(polishTaskId: string): Promise<void> {
    const task = await this.prisma.polishTask.findUnique({
      where: { id: polishTaskId },
      select: {
        id: true,
        userId: true,
        taskId: true,
        title: true,
        originalText: true,
        strength: true,
        mode: true,
        preserveQuotes: true,
        preserveTerms: true,
        status: true,
      },
    });

    if (!task) return;
    if (isTerminal(task.status)) return;

    this.logger.log(
      `process start id=${polishTaskId} userId=${task.userId} strength=${task.strength} mode=${task.mode}`,
    );

    await this.prisma.polishSegment.deleteMany({ where: { polishTaskId } });

    await this.prisma.polishTask.update({
      where: { id: polishTaskId },
      data: {
        status: PolishStatus.PROCESSING,
        progress: 0,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
        polishedText: null,
        polishedLength: null,
        aiScoreBefore: null,
        aiScoreAfter: null,
        tokensConsumed: null,
        modelUsed: null,
      },
    });

    const originalLength = countChargedWords(task.originalText);
    const aiScoreBefore = await this.detector.detect(task.originalText);

    const segmentsRaw = segmentText(task.originalText, 800);
    this.logger.log(
      `process segment count=${segmentsRaw.length} id=${polishTaskId}`,
    );
    await this.prisma.polishSegment.createMany({
      data: segmentsRaw.map((text, idx) => ({
        polishTaskId,
        segmentIndex: idx,
        originalText: text,
        status: PolishStatus.PENDING,
      })),
    });

    const placeholder = new PlaceholderManager();
    const total = segmentsRaw.length;
    let completed = 0;
    let anyFailed = false;
    let tokensTotal = 0;
    let modelUsed: string | undefined;

    for (let i = 0; i < segmentsRaw.length; i += 5) {
      const latest = await this.prisma.polishTask.findUnique({
        where: { id: polishTaskId },
        select: { status: true },
      });
      if (!latest || latest.status === PolishStatus.CANCELLED) return;

      const batch = segmentsRaw.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (segText, offset) => {
          const segmentIndex = i + offset;
          return this.processSegment({
            polishTaskId,
            userId: task.userId,
            taskId: task.taskId ?? polishTaskId,
            segmentIndex,
            text: segText,
            placeholder,
            strength: task.strength,
            mode: task.mode,
            preserveQuotes: task.preserveQuotes,
            preserveTerms: task.preserveTerms,
          });
        }),
      );

      for (const r of results) {
        completed += 1;
        if (r.status === 'fulfilled') {
          tokensTotal += r.value.tokensUsed ?? 0;
          modelUsed = modelUsed ?? r.value.modelUsed;
        } else {
          anyFailed = true;
        }
        const progress = Math.floor((completed / total) * 100);
        await this.prisma.polishTask.update({
          where: { id: polishTaskId },
          data: { progress },
        });
      }
    }

    const latest = await this.prisma.polishTask.findUnique({
      where: { id: polishTaskId },
      select: { status: true },
    });
    if (!latest || latest.status === PolishStatus.CANCELLED) return;

    if (anyFailed) {
      this.logger.warn(
        `process failed id=${polishTaskId} reason=partial_failed`,
      );
      await this.prisma.polishTask.update({
        where: { id: polishTaskId },
        data: {
          status: PolishStatus.FAILED,
          errorMessage: '部分段落处理失败',
          aiScoreBefore,
          originalLength,
          completedAt: new Date(),
          tokensConsumed: tokensTotal,
          modelUsed: modelUsed ?? null,
        },
      });
      return;
    }

    const segments = await this.prisma.polishSegment.findMany({
      where: { polishTaskId },
      orderBy: { segmentIndex: 'asc' },
      select: { polishedText: true },
    });
    const merged = segments.map((s) => s.polishedText ?? '').join('');
    const finalText = postProcess(merged);
    const aiScoreAfter = await this.detector.detect(finalText);
    const polishedLength = countChargedWords(finalText);

    await this.userService.deductQuota(task.userId, originalLength);

    await this.prisma.polishTask.update({
      where: { id: polishTaskId },
      data: {
        status: PolishStatus.SUCCESS,
        progress: 100,
        originalLength,
        polishedLength,
        aiScoreBefore,
        aiScoreAfter,
        polishedText: finalText,
        wordsCharged: originalLength,
        tokensConsumed: tokensTotal,
        modelUsed: modelUsed ?? null,
        completedAt: new Date(),
      },
    });

    await this.quotaService.consume({
      userId: task.userId,
      type: QuotaType.POLISH,
      amount: 1,
      bizId: polishTaskId,
      remark: `润色: ${task.title ?? polishTaskId}`,
    });

    this.logger.log(
      `process success id=${polishTaskId} words=${originalLength}`,
    );
  }

  private async processSegment(params: {
    polishTaskId: string;
    userId: string;
    taskId: string;
    segmentIndex: number;
    text: string;
    placeholder: PlaceholderManager;
    strength: PolishStrength;
    mode: PolishMode;
    preserveQuotes: boolean;
    preserveTerms: string[];
  }): Promise<{ tokensUsed?: number; modelUsed?: string }> {
    const encoded = params.placeholder.encode(
      params.text,
      params.preserveTerms,
    );
    const temperature =
      params.mode === PolishMode.CONSERVATIVE
        ? 0.3
        : params.mode === PolishMode.BALANCED
          ? 0.6
          : 0.9;

    await this.prisma.polishSegment.updateMany({
      where: {
        polishTaskId: params.polishTaskId,
        segmentIndex: params.segmentIndex,
      },
      data: { status: PolishStatus.PROCESSING, errorMessage: null },
    });

    let lastError: string | undefined;
    for (let attempt = 0; attempt <= 2; attempt += 1) {
      const latest = await this.prisma.polishTask.findUnique({
        where: { id: params.polishTaskId },
        select: { status: true },
      });
      if (!latest || latest.status === PolishStatus.CANCELLED) {
        await this.prisma.polishSegment.updateMany({
          where: {
            polishTaskId: params.polishTaskId,
            segmentIndex: params.segmentIndex,
          },
          data: { status: PolishStatus.CANCELLED, errorMessage: null },
        });
        return {};
      }

      try {
        const systemPrompt = buildPolishSystemPrompt({
          strength: params.strength,
          mode: params.mode,
          preserveQuotes: params.preserveQuotes,
          preserveTerms: params.preserveTerms,
        });
        const { content: prompt } = await this.promptService.render(
          'polish.academic',
          { text: encoded },
        );

        const resp = await this.llm.generate(prompt, {
          provider: 'deepseek',
          model: 'deepseek-chat',
          temperature,
          maxTokens: 2000,
          topP: 1,
          systemPrompt,
          taskId: params.taskId,
          stage: 'SUMMARY',
          targetId: `${params.polishTaskId}:${params.segmentIndex}`,
          maxRetries: 0,
          timeout: 90_000,
        });

        const decoded = params.placeholder.decode(resp.content);
        await this.prisma.polishSegment.updateMany({
          where: {
            polishTaskId: params.polishTaskId,
            segmentIndex: params.segmentIndex,
          },
          data: {
            status: PolishStatus.SUCCESS,
            polishedText: decoded,
            tokensUsed: resp.totalTokens,
            errorMessage: null,
            retryCount: attempt,
          },
        });

        return { tokensUsed: resp.totalTokens, modelUsed: resp.model };
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        lastError = message;
        await this.prisma.polishSegment.updateMany({
          where: {
            polishTaskId: params.polishTaskId,
            segmentIndex: params.segmentIndex,
          },
          data: { retryCount: attempt, errorMessage: message },
        });

        if (attempt < 2) {
          const backoff = attempt === 0 ? 1000 : 3000;
          await sleep(backoff);
          continue;
        }
      }
    }

    this.logger.warn(
      `segment failed polishTaskId=${params.polishTaskId} segmentIndex=${params.segmentIndex} error=${lastError ?? 'unknown'}`,
    );

    await this.prisma.polishSegment.updateMany({
      where: {
        polishTaskId: params.polishTaskId,
        segmentIndex: params.segmentIndex,
      },
      data: {
        status: PolishStatus.FAILED,
        errorMessage: lastError ?? 'Unknown error',
      },
    });
    throw new Error(lastError ?? 'Unknown error');
  }
}
