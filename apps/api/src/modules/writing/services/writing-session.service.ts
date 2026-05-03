import { Injectable, Logger } from '@nestjs/common';
import { Prisma, WritingSessionStatus } from '@prisma/client';
import type { WritingSession } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { StartWritingDto } from '../dto/start-writing.dto';

export interface SessionOptions {
  temperature?: number;
  maxTokensPerSection?: number;
}

export type WritingSessionRecord = WritingSession;

@Injectable()
export class WritingSessionService {
  private readonly logger = new Logger(WritingSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    taskId: string,
    outline: { id: string },
    leafNodes: Array<{
      id: string;
      title: string;
      summary: string | null;
      expectedWords: number;
    }>,
    opts: SessionOptions,
  ): Promise<WritingSessionRecord> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.writingSession.create({
        data: {
          taskId,
          outlineSnapshotId: outline.id,
          status: WritingSessionStatus.PENDING,
          totalSections: leafNodes.length,
          completedCount: 0,
          failedCount: 0,
          totalTokens: 0,
        },
      });

      if (leafNodes.length > 0) {
        await tx.writingSection.createMany({
          data: leafNodes.map((n, idx) => ({
            sessionId: session.id,
            outlineNodeId: n.id,
            orderIndex: idx,
            title: n.title,
            summary: n.summary,
            expectedWords: n.expectedWords,
            status: 'PENDING',
            rawContent: null,
            editedContent: null,
            wordCount: 0,
            refKeys: [],
            retryCount: 0,
            errorMessage: null,
            startedAt: null,
            finishedAt: null,
            durationMs: null,
          })),
        });
      }

      this.logger.log(
        `创建 WritingSession: taskId=${taskId} sessionId=${session.id} totalSections=${leafNodes.length} temperature=${opts.temperature ?? 'n/a'} maxTokensPerSection=${opts.maxTokensPerSection ?? 'n/a'}`,
      );

      return session;
    });
  }

  async transitionTo(
    sessionId: string,
    status: WritingSessionStatus,
    extra?: Partial<WritingSessionRecord>,
  ): Promise<void> {
    const hasErrorMessage = Object.hasOwn(extra ?? {}, 'errorMessage');
    const hasCurrentSectionId = Object.hasOwn(extra ?? {}, 'currentSectionId');
    const hasStartedAt = Object.hasOwn(extra ?? {}, 'startedAt');
    const hasFinishedAt = Object.hasOwn(extra ?? {}, 'finishedAt');
    const hasCancelledAt = Object.hasOwn(extra ?? {}, 'cancelledAt');

    const data: Prisma.WritingSessionUpdateInput = { status };
    if (hasErrorMessage) data.errorMessage = extra?.errorMessage ?? null;
    if (hasCurrentSectionId)
      data.currentSectionId = extra?.currentSectionId ?? null;
    if (hasStartedAt) data.startedAt = extra?.startedAt ?? null;
    if (hasFinishedAt) data.finishedAt = extra?.finishedAt ?? null;
    if (hasCancelledAt) data.cancelledAt = extra?.cancelledAt ?? null;

    await this.prisma.writingSession.update({
      where: { id: sessionId },
      data,
    });
    this.logger.log(
      `session 状态更新: sessionId=${sessionId} status=${status}`,
    );
  }

  async incrementCompletedCount(sessionId: string): Promise<void> {
    await this.prisma.writingSession.update({
      where: { id: sessionId },
      data: { completedCount: { increment: 1 } },
    });
  }

  async incrementFailedCount(sessionId: string): Promise<void> {
    await this.prisma.writingSession.update({
      where: { id: sessionId },
      data: { failedCount: { increment: 1 } },
    });
  }

  async addTokens(sessionId: string, tokens: number): Promise<void> {
    if (!Number.isInteger(tokens) || tokens <= 0) return;
    await this.prisma.writingSession.update({
      where: { id: sessionId },
      data: { totalTokens: { increment: tokens } },
    });
  }

  async recalculateCounts(sessionId: string): Promise<{
    completedCount: number;
    failedCount: number;
  }> {
    const [completedCount, failedCount] = await this.prisma.$transaction([
      this.prisma.writingSection.count({
        where: { sessionId, status: 'COMPLETED' },
      }),
      this.prisma.writingSection.count({
        where: { sessionId, status: 'FAILED' },
      }),
    ]);

    await this.prisma.writingSession.update({
      where: { id: sessionId },
      data: { completedCount, failedCount },
    });

    return { completedCount, failedCount };
  }

  async findById(sessionId: string): Promise<WritingSessionRecord | null> {
    return this.prisma.writingSession.findUnique({ where: { id: sessionId } });
  }

  async findActiveByTaskId(
    taskId: string,
  ): Promise<WritingSessionRecord | null> {
    return this.prisma.writingSession.findFirst({
      where: { taskId, status: { in: ['PENDING', 'GENERATING'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLatestByTaskId(
    taskId: string,
  ): Promise<WritingSessionRecord | null> {
    return this.prisma.writingSession.findFirst({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listByTaskId(taskId: string): Promise<WritingSessionRecord[]> {
    return this.prisma.writingSession.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static toSessionOptions(dto: StartWritingDto): SessionOptions {
    return {
      temperature: dto.temperature,
      maxTokensPerSection: dto.maxTokensPerSection,
    };
  }
}
