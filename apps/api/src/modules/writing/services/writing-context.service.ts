import { Injectable } from '@nestjs/common';
import type { Task as PrismaTask } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { TaskService } from '../../task/task.service';
import {
  WRITING_PREVIOUS_TAIL_CHARS,
  WRITING_SECTION_MAX_TOKENS_DEFAULT,
} from '../constants/writing.constants';
import { OutlineNotLockedException } from '../exceptions/outline-not-locked.exception';
import type {
  SectionContext,
  WritingOutlineNode,
  WritingTaskContext,
} from '../interfaces/writing-context.interface';
import { summarizeTail } from '../utils/content-summarizer.util';
import { WritingSectionService } from './writing-section.service';
import { WritingSessionService } from './writing-session.service';

function extractTopicKeywords(requirements: string | null): {
  topic: string;
  keywords: string[];
} {
  const fallback = {
    topic: (requirements ?? '').trim(),
    keywords: [] as string[],
  };
  if (!requirements) return fallback;
  try {
    const parsed = JSON.parse(requirements) as unknown;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const obj = parsed as { topic?: unknown; keywords?: unknown };
    const topic =
      typeof obj.topic === 'string' ? obj.topic.trim() : fallback.topic;
    const keywords =
      Array.isArray(obj.keywords) &&
      obj.keywords.every((k) => typeof k === 'string')
        ? obj.keywords
        : [];
    return { topic, keywords };
  } catch {
    return fallback;
  }
}

function toTaskContext(task: PrismaTask): WritingTaskContext {
  const extracted = extractTopicKeywords(task.requirements);
  return {
    id: task.id,
    title: task.title ?? '',
    educationLevel: task.educationLevel ?? '',
    totalWordCount: task.totalWordCount ?? 0,
    topic: extracted.topic,
    keywords: extracted.keywords,
  };
}

@Injectable()
export class WritingContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
    private readonly sessionService: WritingSessionService,
    private readonly sectionService: WritingSectionService,
  ) {}

  async buildForSection(params: {
    sessionId: string;
    sectionId: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<SectionContext> {
    const session = await this.sessionService.findById(params.sessionId);
    if (!session) {
      throw new Error(`WritingSession 不存在（sessionId=${params.sessionId}）`);
    }

    const section = await this.sectionService.findByIdOrThrow(params.sectionId);
    if (section.sessionId !== params.sessionId) {
      throw new Error(
        `WritingSection 与 sessionId 不匹配（sectionId=${params.sectionId} sessionId=${params.sessionId}）`,
      );
    }

    const task = await this.taskService.findById(session.taskId);

    const outline = await this.prisma.outline.findUnique({
      where: { taskId: session.taskId },
    });
    if (!outline?.locked) {
      throw new OutlineNotLockedException(session.taskId);
    }

    const chapterNodes = await this.prisma.outlineNode.findMany({
      where: { outlineId: outline.id, depth: 1 },
      select: { title: true, path: true },
      orderBy: { path: 'asc' },
    });
    const allChapterTitles = chapterNodes.map((c) => c.title);

    const currentNodeRecord = await this.prisma.outlineNode.findUnique({
      where: { id: section.outlineNodeId },
    });
    if (!currentNodeRecord || currentNodeRecord.outlineId !== outline.id) {
      throw new Error(
        `OutlineNode 不存在或不属于当前大纲（outlineNodeId=${section.outlineNodeId}）`,
      );
    }

    const currentNode: WritingOutlineNode = {
      id: currentNodeRecord.id,
      parentId: currentNodeRecord.parentId,
      title: currentNodeRecord.title,
      summary: currentNodeRecord.summary,
      expectedWords: currentNodeRecord.expectedWords,
      isLeaf: currentNodeRecord.isLeaf,
      path: currentNodeRecord.path,
      orderIndex: currentNodeRecord.orderIndex,
    };

    const pathSegments = currentNode.path.split('/').filter(Boolean);
    const topPath =
      pathSegments.length > 0 ? `/${pathSegments[0]}` : currentNode.path;
    const chapterIndex = chapterNodes.findIndex((c) => c.path === topPath);
    const chapterTitle =
      chapterIndex >= 0
        ? (chapterNodes[chapterIndex]?.title ?? '')
        : (chapterNodes[0]?.title ?? '');
    const chapterLabel =
      chapterIndex >= 0
        ? `第${chapterIndex + 1}章 ${chapterTitle}`
        : chapterTitle;

    let previousSummary: string | null = null;
    if (section.orderIndex > 0) {
      const prev = await this.sectionService.findBySessionAndOrderIndex(
        params.sessionId,
        section.orderIndex - 1,
      );
      if (prev) {
        const content = this.sectionService.getEffectiveContent(prev);
        if (content) {
          const tail = summarizeTail(content, WRITING_PREVIOUS_TAIL_CHARS);
          previousSummary = tail ? tail : null;
        }
      }
    }

    const temperature = params.temperature ?? 0.7;
    const maxTokens = params.maxTokens ?? WRITING_SECTION_MAX_TOKENS_DEFAULT;

    return {
      task: toTaskContext(task),
      outline: {
        outlineId: outline.id,
        locked: outline.locked,
        lockedAt: outline.lockedAt ? outline.lockedAt.toISOString() : null,
        allChapterTitles,
      },
      currentNode,
      previousSummary,
      position: {
        chapter: chapterLabel,
        sectionIndex: section.orderIndex + 1,
      },
      allChapterTitles,
      temperature,
      maxTokens,
    };
  }
}
