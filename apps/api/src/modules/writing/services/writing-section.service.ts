import { Injectable } from '@nestjs/common';
import type { WritingSection } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SectionNotFoundException } from '../exceptions/section-not-found.exception';
import { countWords } from '../utils/word-counter.util';

export type WritingSectionRecord = WritingSection;

@Injectable()
export class WritingSectionService {
  constructor(private readonly prisma: PrismaService) {}

  async listBySessionId(sessionId: string): Promise<WritingSectionRecord[]> {
    return this.prisma.writingSection.findMany({
      where: { sessionId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async findById(sectionId: string): Promise<WritingSectionRecord | null> {
    return this.prisma.writingSection.findUnique({ where: { id: sectionId } });
  }

  async findByIdOrThrow(sectionId: string): Promise<WritingSectionRecord> {
    const row = await this.findById(sectionId);
    if (!row) throw new SectionNotFoundException(sectionId);
    return row;
  }

  async findBySessionAndOrderIndex(
    sessionId: string,
    orderIndex: number,
  ): Promise<WritingSectionRecord | null> {
    return this.prisma.writingSection.findFirst({
      where: { sessionId, orderIndex },
    });
  }

  async findNextPending(
    sessionId: string,
  ): Promise<WritingSectionRecord | null> {
    return this.prisma.writingSection.findFirst({
      where: { sessionId, status: 'PENDING' },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async markGenerating(sectionId: string): Promise<WritingSectionRecord> {
    try {
      return await this.prisma.writingSection.update({
        where: { id: sectionId },
        data: {
          status: 'GENERATING',
          errorMessage: null,
          startedAt: new Date(),
        },
      });
    } catch {
      throw new SectionNotFoundException(sectionId);
    }
  }

  async markCompleted(params: {
    sectionId: string;
    rawContent: string;
    refKeys: string[];
    durationMs: number | null;
  }): Promise<WritingSectionRecord> {
    const wordCount = countWords(params.rawContent);
    try {
      return await this.prisma.writingSection.update({
        where: { id: params.sectionId },
        data: {
          status: 'COMPLETED',
          rawContent: params.rawContent,
          wordCount,
          refKeys: params.refKeys,
          errorMessage: null,
          finishedAt: new Date(),
          durationMs: params.durationMs,
        },
      });
    } catch {
      throw new SectionNotFoundException(params.sectionId);
    }
  }

  async markFailed(params: {
    sectionId: string;
    errorMessage: string;
    durationMs: number | null;
  }): Promise<WritingSectionRecord> {
    try {
      return await this.prisma.writingSection.update({
        where: { id: params.sectionId },
        data: {
          status: 'FAILED',
          errorMessage: params.errorMessage,
          finishedAt: new Date(),
          durationMs: params.durationMs,
        },
      });
    } catch {
      throw new SectionNotFoundException(params.sectionId);
    }
  }

  async resetForRetry(sectionId: string): Promise<WritingSectionRecord> {
    try {
      return await this.prisma.writingSection.update({
        where: { id: sectionId },
        data: {
          status: 'PENDING',
          rawContent: null,
          editedContent: null,
          wordCount: 0,
          refKeys: [],
          retryCount: { increment: 1 },
          errorMessage: null,
          startedAt: null,
          finishedAt: null,
          durationMs: null,
        },
      });
    } catch {
      throw new SectionNotFoundException(sectionId);
    }
  }

  async resetFromOrderIndex(params: {
    sessionId: string;
    fromOrderIndex: number;
  }): Promise<number> {
    const result = await this.prisma.writingSection.updateMany({
      where: {
        sessionId: params.sessionId,
        orderIndex: { gte: params.fromOrderIndex },
      },
      data: {
        status: 'PENDING',
        rawContent: null,
        editedContent: null,
        wordCount: 0,
        refKeys: [],
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
      },
    });
    return result.count;
  }

  async updateEditedContent(params: {
    sectionId: string;
    content: string;
  }): Promise<WritingSectionRecord> {
    const wordCount = countWords(params.content);
    try {
      return await this.prisma.writingSection.update({
        where: { id: params.sectionId },
        data: {
          status: 'COMPLETED',
          editedContent: params.content,
          wordCount,
        },
      });
    } catch {
      throw new SectionNotFoundException(params.sectionId);
    }
  }

  getEffectiveContent(
    section: Pick<WritingSectionRecord, 'editedContent' | 'rawContent'>,
  ): string | null {
    return section.editedContent ?? section.rawContent ?? null;
  }
}
