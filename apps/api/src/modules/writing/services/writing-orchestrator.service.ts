import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { StartWritingDto } from '../dto/start-writing.dto';
import type { RetrySectionDto } from '../dto/retry-section.dto';
import { WRITING_MAX_CONSECUTIVE_FAILURES } from '../constants/writing.constants';
import { WRITING_SSE_EVENTS } from '../constants/sse-event.constants';
import { OutlineNotLockedException } from '../exceptions/outline-not-locked.exception';
import { WritingAlreadyRunningException } from '../exceptions/writing-already-running.exception';
import type { WritingSseEvent } from '../interfaces/sse-event.interface';
import { extractRefKeys } from '../utils/ref-extractor.util';
import { WritingContextService } from './writing-context.service';
import { WritingGeneratorService } from './writing-generator.service';
import { WritingSectionService } from './writing-section.service';
import { WritingSessionService } from './writing-session.service';

type CancelState = { cancelled: boolean };

@Injectable()
export class WritingOrchestratorService {
  private readonly logger = new Logger(WritingOrchestratorService.name);
  private readonly cancelStates = new Map<string, CancelState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: WritingSessionService,
    private readonly sectionService: WritingSectionService,
    private readonly contextService: WritingContextService,
    private readonly generator: WritingGeneratorService,
  ) {}

  requestCancel(sessionId: string): void {
    const state = this.cancelStates.get(sessionId);
    if (state) state.cancelled = true;
  }

  async *resumeWriting(
    taskId: string,
    sessionId: string,
    dto: StartWritingDto,
    fromOrderIndex = 0,
  ): AsyncGenerator<WritingSseEvent, void, unknown> {
    const session = await this.sessionService.findById(sessionId);
    if (!session) {
      throw new BadRequestException(`写作会话不存在（sessionId=${sessionId}）`);
    }
    if (session.taskId !== taskId) {
      throw new BadRequestException('sessionId 不属于该 taskId');
    }

    const active = await this.sessionService.findActiveByTaskId(taskId);
    if (active && active.id !== sessionId) {
      throw new WritingAlreadyRunningException(taskId);
    }
    if (this.cancelStates.has(sessionId)) {
      throw new WritingAlreadyRunningException(taskId);
    }

    if (session.status === 'COMPLETED') {
      yield {
        event: WRITING_SSE_EVENTS.SESSION_COMPLETE,
        data: { sessionId },
      };
      return;
    }

    yield* this.runSession(taskId, sessionId, dto, fromOrderIndex);
  }

  async *regenerateFrom(
    taskId: string,
    sessionId: string,
    dto: StartWritingDto,
    fromOrderIndex: number,
  ): AsyncGenerator<WritingSseEvent, void, unknown> {
    if (!Number.isInteger(fromOrderIndex) || fromOrderIndex < 0) {
      throw new BadRequestException('fromOrderIndex 不合法');
    }

    const session = await this.sessionService.findById(sessionId);
    if (!session) {
      throw new BadRequestException(`写作会话不存在（sessionId=${sessionId}）`);
    }
    if (session.taskId !== taskId) {
      throw new BadRequestException('sessionId 不属于该 taskId');
    }

    const active = await this.sessionService.findActiveByTaskId(taskId);
    if (active && active.id !== sessionId) {
      throw new WritingAlreadyRunningException(taskId);
    }
    if (this.cancelStates.has(sessionId)) {
      throw new WritingAlreadyRunningException(taskId);
    }

    await this.sectionService.resetFromOrderIndex({
      sessionId,
      fromOrderIndex,
    });
    await this.sessionService.recalculateCounts(sessionId);

    yield* this.runSession(taskId, sessionId, dto, fromOrderIndex);
  }

  async *retrySection(
    taskId: string,
    sessionId: string,
    sectionId: string,
    dto: RetrySectionDto,
  ): AsyncGenerator<WritingSseEvent, void, unknown> {
    const session = await this.sessionService.findById(sessionId);
    if (!session) {
      throw new BadRequestException(`写作会话不存在（sessionId=${sessionId}）`);
    }
    if (session.taskId !== taskId) {
      throw new BadRequestException('sessionId 不属于该 taskId');
    }

    const active = await this.sessionService.findActiveByTaskId(taskId);
    if (active && active.id !== sessionId) {
      throw new WritingAlreadyRunningException(taskId);
    }
    if (this.cancelStates.has(sessionId)) {
      throw new WritingAlreadyRunningException(taskId);
    }

    const outline = await this.prisma.outline.findUnique({ where: { taskId } });
    if (!outline?.locked) throw new OutlineNotLockedException(taskId);

    const section = await this.sectionService.resetForRetry(sectionId);
    await this.sessionService.recalculateCounts(sessionId);

    const cancelState: CancelState = { cancelled: false };
    this.cancelStates.set(sessionId, cancelState);

    try {
      await this.sessionService.transitionTo(sessionId, 'GENERATING', {
        currentSectionId: section.id,
        errorMessage: null,
        finishedAt: null,
        cancelledAt: null,
      });

      yield {
        event: WRITING_SSE_EVENTS.SESSION_START,
        data: { sessionId, totalSections: session.totalSections },
      };

      yield {
        event: WRITING_SSE_EVENTS.SECTION_START,
        data: {
          sectionId: section.id,
          nodeId: section.outlineNodeId,
          title: section.title,
          index: section.orderIndex + 1,
          total: session.totalSections,
        },
      };

      const ctx = await this.contextService.buildForSection({
        sessionId,
        sectionId: section.id,
      });

      const startTs = Date.now();
      const gen = await this.generator.createRetryStream({
        ctx,
        feedback: dto.feedback ?? '',
        llmOptions: {
          taskId,
          stage: 'SECTION',
          targetId: section.id,
          temperature: ctx.temperature,
          maxTokens: ctx.maxTokens,
        },
      });

      for await (const chunk of gen.stream) {
        if (cancelState.cancelled) break;
        yield {
          event: WRITING_SSE_EVENTS.SECTION_TOKEN,
          data: { sectionId: section.id, token: chunk },
        };
      }

      if (cancelState.cancelled) {
        await this.sectionService.markFailed({
          sectionId: section.id,
          errorMessage: 'CANCELLED',
          durationMs: Date.now() - startTs,
        });
        yield {
          event: WRITING_SSE_EVENTS.SESSION_ERROR,
          data: { error: 'CANCELLED', recoverable: true },
        };
        return;
      }

      const done = await gen.done;
      const refKeys = extractRefKeys(done.content);
      const updated = await this.sectionService.markCompleted({
        sectionId: section.id,
        rawContent: done.content,
        refKeys,
        durationMs: Date.now() - startTs,
      });
      await this.sessionService.addTokens(sessionId, done.estimatedTokens);

      const counts = await this.sessionService.recalculateCounts(sessionId);
      yield {
        event: WRITING_SSE_EVENTS.SECTION_COMPLETE,
        data: { sectionId: updated.id, wordCount: updated.wordCount },
      };
      yield {
        event: WRITING_SSE_EVENTS.PROGRESS,
        data: {
          completed: counts.completedCount,
          total: session.totalSections,
          percentage: Math.round(
            (counts.completedCount / session.totalSections) * 100,
          ),
        },
      };

      if (counts.failedCount > 0) {
        await this.sessionService.transitionTo(sessionId, 'FAILED', {
          errorMessage: `失败小节数：${counts.failedCount}`,
          currentSectionId: null,
        });
        yield {
          event: WRITING_SSE_EVENTS.SESSION_ERROR,
          data: {
            error: `失败小节数：${counts.failedCount}`,
            recoverable: true,
          },
        };
        return;
      }

      if (counts.completedCount >= session.totalSections) {
        await this.sessionService.transitionTo(sessionId, 'COMPLETED', {
          finishedAt: new Date(),
          currentSectionId: null,
          errorMessage: null,
        });
        yield {
          event: WRITING_SSE_EVENTS.SESSION_COMPLETE,
          data: { sessionId },
        };
        return;
      }

      await this.sessionService.transitionTo(sessionId, 'GENERATING', {
        currentSectionId: null,
        errorMessage: null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      yield {
        event: WRITING_SSE_EVENTS.SESSION_ERROR,
        data: { error: message, recoverable: true },
      };
    } finally {
      this.cancelStates.delete(sessionId);
    }
  }

  async *startWriting(
    taskId: string,
    dto: StartWritingDto,
  ): AsyncGenerator<WritingSseEvent, void, unknown> {
    const existing = await this.sessionService.findActiveByTaskId(taskId);
    if (existing) throw new WritingAlreadyRunningException(taskId);

    const outline = await this.prisma.outline.findUnique({ where: { taskId } });
    if (!outline?.locked) throw new OutlineNotLockedException(taskId);

    const leafNodes = await this.prisma.outlineNode.findMany({
      where: { outlineId: outline.id, isLeaf: true },
      orderBy: { path: 'asc' },
      select: { id: true, title: true, summary: true, expectedWords: true },
    });

    const opts = WritingSessionService.toSessionOptions(dto);
    const session = await this.sessionService.create(
      taskId,
      { id: outline.id },
      leafNodes.map((n) => ({
        id: n.id,
        title: n.title,
        summary: n.summary,
        expectedWords: n.expectedWords,
      })),
      opts,
    );

    const cancelState: CancelState = { cancelled: false };
    this.cancelStates.set(session.id, cancelState);

    try {
      yield* this.runSession(taskId, session.id, dto, 0);
    } finally {
      this.cancelStates.delete(session.id);
      this.logger.log(`写作编排结束: taskId=${taskId} sessionId=${session.id}`);
    }
  }

  private async *runSession(
    taskId: string,
    sessionId: string,
    dto: StartWritingDto,
    fromOrderIndex: number,
  ): AsyncGenerator<WritingSseEvent, void, unknown> {
    const outline = await this.prisma.outline.findUnique({ where: { taskId } });
    if (!outline?.locked) throw new OutlineNotLockedException(taskId);

    const opts = WritingSessionService.toSessionOptions(dto);
    const cancelState: CancelState = { cancelled: false };
    this.cancelStates.set(sessionId, cancelState);

    try {
      await this.sessionService.transitionTo(sessionId, 'GENERATING', {
        startedAt: new Date(),
        currentSectionId: null,
        errorMessage: null,
        finishedAt: null,
        cancelledAt: null,
      });

      const sections = await this.sectionService.listBySessionId(sessionId);
      const total = sections.length;

      yield {
        event: WRITING_SSE_EVENTS.SESSION_START,
        data: { sessionId, totalSections: total },
      };

      let consecutiveFailures = 0;

      for (const section of sections) {
        if (cancelState.cancelled) break;
        if (section.orderIndex < fromOrderIndex) continue;
        if (section.status === 'COMPLETED') continue;

        await this.sessionService.transitionTo(sessionId, 'GENERATING', {
          currentSectionId: section.id,
          errorMessage: null,
        });
        const generating = await this.sectionService.markGenerating(section.id);

        yield {
          event: WRITING_SSE_EVENTS.SECTION_START,
          data: {
            sectionId: generating.id,
            nodeId: generating.outlineNodeId,
            title: generating.title,
            index: generating.orderIndex + 1,
            total,
          },
        };

        const ctx = await this.contextService.buildForSection({
          sessionId,
          sectionId: generating.id,
          temperature: opts.temperature,
          maxTokens: opts.maxTokensPerSection,
        });

        const startTs = Date.now();
        try {
          const gen = await this.generator.createSectionStream({
            ctx,
            llmOptions: {
              taskId,
              stage: 'SECTION',
              targetId: generating.id,
              temperature: ctx.temperature,
              maxTokens: ctx.maxTokens,
            },
          });

          for await (const chunk of gen.stream) {
            if (cancelState.cancelled) break;
            yield {
              event: WRITING_SSE_EVENTS.SECTION_TOKEN,
              data: { sectionId: generating.id, token: chunk },
            };
          }

          if (cancelState.cancelled) break;

          const done = await gen.done;
          const refKeys = extractRefKeys(done.content);
          const updated = await this.sectionService.markCompleted({
            sectionId: generating.id,
            rawContent: done.content,
            refKeys,
            durationMs: Date.now() - startTs,
          });
          await this.sessionService.addTokens(sessionId, done.estimatedTokens);

          const counts = await this.sessionService.recalculateCounts(sessionId);
          consecutiveFailures = 0;

          yield {
            event: WRITING_SSE_EVENTS.SECTION_COMPLETE,
            data: { sectionId: updated.id, wordCount: updated.wordCount },
          };
          yield {
            event: WRITING_SSE_EVENTS.PROGRESS,
            data: {
              completed: counts.completedCount,
              total,
              percentage: Math.round((counts.completedCount / total) * 100),
            },
          };
        } catch (error: unknown) {
          const durationMs = Date.now() - startTs;
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          await this.sectionService.markFailed({
            sectionId: generating.id,
            errorMessage: message,
            durationMs,
          });

          const counts = await this.sessionService.recalculateCounts(sessionId);
          consecutiveFailures += 1;

          yield {
            event: WRITING_SSE_EVENTS.SECTION_FAILED,
            data: { sectionId: generating.id, error: message, retryable: true },
          };
          yield {
            event: WRITING_SSE_EVENTS.PROGRESS,
            data: {
              completed: counts.completedCount,
              total,
              percentage: Math.round((counts.completedCount / total) * 100),
            },
          };

          if (consecutiveFailures >= WRITING_MAX_CONSECUTIVE_FAILURES) {
            await this.sessionService.transitionTo(sessionId, 'FAILED', {
              errorMessage: `连续失败超过阈值：${WRITING_MAX_CONSECUTIVE_FAILURES}`,
              finishedAt: new Date(),
              currentSectionId: null,
            });
            yield {
              event: WRITING_SSE_EVENTS.SESSION_ERROR,
              data: {
                error: `连续失败超过阈值：${WRITING_MAX_CONSECUTIVE_FAILURES}`,
                recoverable: true,
              },
            };
            return;
          }
        }
      }

      if (cancelState.cancelled) {
        await this.sessionService.transitionTo(sessionId, 'CANCELLED', {
          cancelledAt: new Date(),
          finishedAt: new Date(),
          currentSectionId: null,
        });
        yield {
          event: WRITING_SSE_EVENTS.SESSION_ERROR,
          data: { error: 'CANCELLED', recoverable: true },
        };
        return;
      }

      const finalCounts =
        await this.sessionService.recalculateCounts(sessionId);
      if (finalCounts.failedCount > 0) {
        await this.sessionService.transitionTo(sessionId, 'FAILED', {
          errorMessage: `失败小节数：${finalCounts.failedCount}`,
          finishedAt: new Date(),
          currentSectionId: null,
        });
        yield {
          event: WRITING_SSE_EVENTS.SESSION_ERROR,
          data: {
            error: `失败小节数：${finalCounts.failedCount}`,
            recoverable: true,
          },
        };
        return;
      }

      if (finalCounts.completedCount >= total) {
        await this.sessionService.transitionTo(sessionId, 'COMPLETED', {
          finishedAt: new Date(),
          currentSectionId: null,
          errorMessage: null,
        });
        yield {
          event: WRITING_SSE_EVENTS.SESSION_COMPLETE,
          data: { sessionId },
        };
        return;
      }
    } finally {
      this.cancelStates.delete(sessionId);
    }
  }
}
