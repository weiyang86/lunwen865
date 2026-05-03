import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { TaskStage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskService } from '../task/task.service';
import { GenerationStage } from '../task/constants/generation-stage.enum';
import { OutlineLockedException } from './exceptions/outline-locked.exception';
import { OutlineNotFoundException } from './exceptions/outline-not-found.exception';
import { InvalidTreeStructureException } from './exceptions/invalid-tree-structure.exception';
import type { GenerateOutlineDto } from './dto/generate-outline.dto';
import type {
  OutlineNodeRecord,
  OutlineRecord,
  OutlineTreeDto,
} from './interfaces/outline-tree.interface';
import { buildTree, flattenLlmTree } from './utils/tree-builder.util';
import { computeNumbering } from './utils/numbering.util';
import { normalizeWordCount } from './utils/word-allocator.util';
import {
  OUTLINE_DEFAULT_MAX_DEPTH,
  OUTLINE_GENERATION_WORDCOUNT_MAX_RATIO,
  OUTLINE_GENERATION_WORDCOUNT_MIN_RATIO,
} from './constants/outline.constants';
import { OutlineGeneratorService } from './outline-generator.service';
import { OutlineValidatorService } from './outline-validator.service';
import type { AcademicLevel } from './prompts/outline-generation.prompt';

type OutlineWithNodes = OutlineRecord & { nodes: OutlineNodeRecord[] };

function toAcademicLevel(educationLevel: string): AcademicLevel {
  if (educationLevel.includes('博士')) return 'DOCTOR';
  if (educationLevel.includes('硕士') || educationLevel.includes('研究生'))
    return 'MASTER';
  return 'UNDERGRADUATE';
}

function extractTopicKeywordsLanguage(requirements: string | null): {
  topic: string;
  keywords: string[];
  language: string;
} {
  const fallback = {
    topic: (requirements ?? '').trim(),
    keywords: [],
    language: 'zh-CN',
  };

  if (!requirements) return fallback;

  try {
    const parsed = JSON.parse(requirements) as unknown;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const obj = parsed as {
      topic?: unknown;
      keywords?: unknown;
      language?: unknown;
    };
    const topic =
      typeof obj.topic === 'string' ? obj.topic.trim() : fallback.topic;
    const keywords =
      Array.isArray(obj.keywords) &&
      obj.keywords.every((k) => typeof k === 'string')
        ? obj.keywords
        : [];
    const language = typeof obj.language === 'string' ? obj.language : 'zh-CN';
    return { topic, keywords, language };
  } catch {
    return fallback;
  }
}

@Injectable()
export class OutlineService {
  private readonly logger = new Logger(OutlineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
    private readonly generator: OutlineGeneratorService,
    private readonly validator: OutlineValidatorService,
  ) {}

  async generate(
    taskId: string,
    dto: GenerateOutlineDto,
  ): Promise<OutlineTreeDto> {
    const startedAt = Date.now();

    const task = await this.taskService.findById(taskId);
    const targetWordCount = task.totalWordCount ?? 0;
    if (!Number.isInteger(targetWordCount) || targetWordCount <= 0) {
      throw new BadRequestException('任务未设置目标字数（totalWordCount）');
    }

    if (task.currentStage === TaskStage.TOPIC) {
      throw new BadRequestException('请先完成开题报告');
    }

    const openingReport = await this.prisma.openingReport.findFirst({
      where: { taskId, status: 'COMPLETED' },
      orderBy: { version: 'desc' },
    });
    if (!openingReport || openingReport.status !== 'COMPLETED') {
      throw new BadRequestException('开题报告未完成');
    }
    if (!openingReport.fullContent) {
      throw new BadRequestException('开题报告缺少 fullContent');
    }

    const existing = await this.prisma.outline.findUnique({
      where: { taskId },
    });
    if (existing?.locked) {
      throw new OutlineLockedException(taskId);
    }

    if (existing) {
      await this.prisma.outline.delete({ where: { id: existing.id } });
    }

    const extracted = extractTopicKeywordsLanguage(task.requirements);
    const maxDepth = dto.maxDepth ?? OUTLINE_DEFAULT_MAX_DEPTH;
    const context = {
      taskId,
      title: task.title ?? '',
      topic: extracted.topic,
      keywords: extracted.keywords,
      academicLevel: toAcademicLevel(task.educationLevel),
      targetWordCount,
      openingReportContent: openingReport.fullContent,
      additionalRequirements: dto.additionalRequirements,
      maxDepth,
      model: dto.model,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
      maxRetries: dto.maxRetries,
      timeout: dto.timeout,
    };

    const llmResponse =
      await this.generator.generateOutlineFromContext(context);

    const outline = await this.prisma.$transaction(async (tx) => {
      const created = await tx.outline.create({
        data: {
          taskId,
          status: 'DRAFT',
          locked: false,
          targetWordCount,
          maxDepth,
          totalWordCount: 0,
          llmModel: dto.model ?? null,
          totalTokensUsed: 0,
          generationDurationMs: Date.now() - startedAt,
          version: 1,
        },
      });

      const flatNodes = flattenLlmTree(
        llmResponse.chapters,
        created.id,
        maxDepth,
      );

      if (flatNodes.length === 0) {
        throw new InvalidTreeStructureException('LLM returned empty outline');
      }

      const leaves = flatNodes.filter((n) => n.isLeaf);
      const sum = leaves.reduce((acc, n) => acc + (n.expectedWords ?? 0), 0);
      const min = Math.floor(
        targetWordCount * OUTLINE_GENERATION_WORDCOUNT_MIN_RATIO,
      );
      const max = Math.ceil(
        targetWordCount * OUTLINE_GENERATION_WORDCOUNT_MAX_RATIO,
      );
      const normalized =
        sum >= min && sum <= max
          ? normalizeWordCount(
              leaves.map((l) => ({
                id: l.id,
                expectedWords: l.expectedWords ?? 0,
              })),
              targetWordCount,
            )
          : normalizeWordCount(
              leaves.map((l) => ({
                id: l.id,
                expectedWords: l.expectedWords ?? 0,
              })),
              targetWordCount,
            );

      flatNodes.forEach((n) => {
        if (n.isLeaf) {
          n.expectedWords = normalized.get(n.id) ?? n.expectedWords ?? 0;
        } else {
          n.expectedWords = 0;
        }
      });

      await tx.outlineNode.createMany({
        data: flatNodes,
      });

      const total = flatNodes.reduce(
        (acc, n) => acc + (n.isLeaf ? (n.expectedWords ?? 0) : 0),
        0,
      );

      return tx.outline.update({
        where: { id: created.id },
        data: { totalWordCount: total },
        include: { nodes: { orderBy: { path: 'asc' } } },
      });
    });

    return this.toTreeDto(outline);
  }

  async findByTaskId(taskId: string): Promise<OutlineTreeDto> {
    const outline = await this.prisma.outline.findUnique({
      where: { taskId },
      include: { nodes: { orderBy: { path: 'asc' } } },
    });
    if (!outline) throw new OutlineNotFoundException(taskId);
    return this.toTreeDto(outline);
  }

  async findFlatByTaskId(taskId: string): Promise<OutlineNodeRecord[]> {
    const outline = await this.prisma.outline.findUnique({ where: { taskId } });
    if (!outline) throw new OutlineNotFoundException(taskId);
    return this.prisma.outlineNode.findMany({
      where: { outlineId: outline.id },
      orderBy: { path: 'asc' },
    });
  }

  async lock(taskId: string) {
    const outline = await this.prisma.outline.findUnique({
      where: { taskId },
      include: { nodes: { orderBy: { path: 'asc' } } },
    });
    if (!outline) throw new OutlineNotFoundException(taskId);
    if (outline.locked) return outline;

    this.validator.validateForLock(outline, outline.targetWordCount);

    const updated = await this.prisma.outline.update({
      where: { id: outline.id },
      data: { locked: true, lockedAt: new Date(), status: 'LOCKED' },
    });

    await this.taskService.onStageCompleted(taskId, GenerationStage.OUTLINE);
    return updated;
  }

  async unlock(taskId: string) {
    const outline = await this.prisma.outline.findUnique({ where: { taskId } });
    if (!outline) throw new OutlineNotFoundException(taskId);
    if (!outline.locked) return outline;

    const task = await this.taskService.findById(taskId);
    if (
      task.currentStage === TaskStage.WRITING ||
      task.currentStage === TaskStage.MERGING ||
      task.currentStage === TaskStage.FORMATTING ||
      task.currentStage === TaskStage.REVIEW ||
      task.currentStage === TaskStage.REVISION
    ) {
      throw new BadRequestException('已进入正文生成流程，禁止解锁');
    }

    const updated = await this.prisma.outline.update({
      where: { id: outline.id },
      data: { locked: false, lockedAt: null, status: 'DRAFT' },
    });

    return updated;
  }

  async deleteOutline(taskId: string): Promise<void> {
    const outline = await this.prisma.outline.findUnique({ where: { taskId } });
    if (!outline) throw new OutlineNotFoundException(taskId);
    if (outline.locked) throw new OutlineLockedException(taskId);
    await this.prisma.outline.delete({ where: { id: outline.id } });
  }

  async redistributeWords(taskId: string): Promise<OutlineTreeDto> {
    const outline = await this.assertNotLocked(taskId);
    const nodes = await this.prisma.outlineNode.findMany({
      where: { outlineId: outline.id },
      orderBy: { path: 'asc' },
    });

    const leaves = nodes.filter((n) => n.isLeaf);
    const normalized = normalizeWordCount(
      leaves.map((l) => ({ id: l.id, expectedWords: l.expectedWords })),
      outline.targetWordCount,
    );

    await this.prisma.$transaction(async (tx) => {
      for (const leaf of leaves) {
        await tx.outlineNode.update({
          where: { id: leaf.id },
          data: {
            expectedWords: normalized.get(leaf.id) ?? leaf.expectedWords,
          },
        });
      }

      const total = await this.recalculateTotalWordCount(outline.id);
      await tx.outline.update({
        where: { id: outline.id },
        data: { totalWordCount: total },
      });
    });

    return this.findByTaskId(taskId);
  }

  private async assertNotLocked(taskId: string) {
    const outline = await this.prisma.outline.findUnique({ where: { taskId } });
    if (!outline) throw new OutlineNotFoundException(taskId);
    if (outline.locked) throw new OutlineLockedException(taskId);
    return outline;
  }

  private async recalculateTotalWordCount(outlineId: string): Promise<number> {
    const nodes = await this.prisma.outlineNode.findMany({
      where: { outlineId, isLeaf: true },
      select: { expectedWords: true },
    });
    return nodes.reduce((acc, n) => acc + (n.expectedWords ?? 0), 0);
  }

  private toTreeDto(outline: OutlineWithNodes): OutlineTreeDto {
    const numbering = computeNumbering(
      outline.nodes.map((n) => ({ id: n.id, path: n.path, depth: n.depth })),
    );

    const tree = buildTree(outline.nodes);

    const attach = (nodes: Array<ReturnType<typeof buildTree>[number]>) => {
      for (const node of nodes) {
        node.numbering = numbering.get(node.id) ?? null;
        attach(node.children);
      }
    };
    attach(tree);

    return {
      outline,
      nodes: tree,
    };
  }
}
