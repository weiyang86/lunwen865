import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { Prisma, Task, TopicCandidate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { TaskService } from '../task/task.service';
import { GenerationStage } from '../task/constants/generation-stage.enum';
import {
  DEFAULT_TOPIC_COUNT,
  TOPIC_GENERATION_COOLDOWN_MS,
  TOPIC_RATIONALE_MAX_LEN,
} from './constants/topic.constants';
import type { GenerateTopicDto } from './dto/generate-topic.dto';
import type { RegenerateTopicDto } from './dto/regenerate-topic.dto';
import { InvalidTaskStageException } from './exceptions/invalid-task-stage.exception';
import { TopicGenerationFailedException } from './exceptions/topic-generation-failed.exception';
import { TopicNotFoundException } from './exceptions/topic-not-found.exception';
import type { LlmTopicOutput } from './interfaces/llm-topic-output.interface';
import type { EstimatedDifficulty } from './interfaces/llm-topic-output.interface';
import type { TopicCandidateView } from './interfaces/topic-candidate.interface';
import { buildTopicGenerationPrompt } from './prompts/topic-generation.prompt';
import { TOPIC_GENERATION_ZOD_SCHEMA } from './prompts/topic-generation.schema';

type AcademicLevel = 'UNDERGRADUATE' | 'MASTER' | 'DOCTOR';

interface TopicCandidateMetaV1 {
  generationBatch: number;
  rationale?: string;
  keywords?: string[];
  estimatedDifficulty?: EstimatedDifficulty;
}

function toAcademicLevel(educationLevel: string): AcademicLevel {
  if (educationLevel.includes('博士')) return 'DOCTOR';
  if (educationLevel.includes('硕士') || educationLevel.includes('研究生'))
    return 'MASTER';
  return 'UNDERGRADUATE';
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

function uniqueCandidatesByTitle<T extends { title: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = normalizeTitle(item.title).toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function parseMeta(description: string | null): TopicCandidateMetaV1 | null {
  if (!description) return null;
  try {
    const parsed = JSON.parse(description) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as { generationBatch?: unknown };
    if (typeof obj.generationBatch !== 'number') return null;
    return parsed as TopicCandidateMetaV1;
  } catch {
    return null;
  }
}

function buildDescription(meta: TopicCandidateMetaV1): string {
  return JSON.stringify(meta);
}

function extractTopicKeywordsLanguage(task: Task): {
  topic: string;
  keywords: string[];
  language: string;
} {
  const fallback = {
    topic: (task.requirements ?? '').trim(),
    keywords: [],
    language: 'zh-CN',
  };

  if (!task.requirements) return fallback;

  try {
    const parsed = JSON.parse(task.requirements) as unknown;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const obj = parsed as {
      topic?: unknown;
      keywords?: unknown;
      language?: unknown;
    };
    if (typeof obj.topic !== 'string') return fallback;

    const keywords =
      Array.isArray(obj.keywords) &&
      obj.keywords.every((k) => typeof k === 'string')
        ? obj.keywords
        : [];

    const language = typeof obj.language === 'string' ? obj.language : 'zh-CN';

    return {
      topic: obj.topic.trim(),
      keywords,
      language,
    };
  } catch {
    return fallback;
  }
}

@Injectable()
export class TopicService {
  private readonly logger = new Logger(TopicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
    private readonly taskService: TaskService,
  ) {}

  /**
   * 为指定任务生成候选题目（默认 5 个）
   */
  async generateTopics(
    taskId: string,
    dto?: GenerateTopicDto,
  ): Promise<TopicCandidate[]> {
    return this.generateInternal(taskId, {
      count: dto?.count ?? DEFAULT_TOPIC_COUNT,
      additionalContext: dto?.additionalContext,
      preferredStyle: dto?.preferredStyle,
    });
  }

  /**
   * 重新生成候选题目（保留历史，新增一批）
   */
  async regenerateTopics(
    taskId: string,
    dto: RegenerateTopicDto,
  ): Promise<TopicCandidate[]> {
    return this.generateInternal(taskId, {
      count: dto.count ?? DEFAULT_TOPIC_COUNT,
      feedback: dto.feedback,
      rejectedTitles: dto.rejectedTitles,
      preferredStyle: dto.preferredStyle,
    });
  }

  /**
   * 查询某任务的所有候选题目（按 generationBatch 倒序、createdAt 倒序）
   */
  async findCandidatesByTaskId(taskId: string): Promise<TopicCandidateView[]> {
    await this.taskService.findById(taskId);
    const candidates = await this.prisma.topicCandidate.findMany({
      where: { taskId },
      orderBy: [{ createdAt: 'desc' }],
    });

    return candidates
      .map((c) => this.toView(c))
      .sort((a, b) => {
        if (a.generationBatch !== b.generationBatch) {
          return b.generationBatch - a.generationBatch;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  /**
   * 查询某任务最新一批候选题目
   */
  async findLatestCandidates(taskId: string): Promise<TopicCandidateView[]> {
    const all = await this.findCandidatesByTaskId(taskId);
    if (all.length === 0) return [];
    const latestBatch = Math.max(...all.map((x) => x.generationBatch));
    return all.filter((x) => x.generationBatch === latestBatch);
  }

  /**
   * 查询单个候选详情
   */
  async findCandidateById(candidateId: string): Promise<TopicCandidateView> {
    const candidate = await this.prisma.topicCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) throw new TopicNotFoundException(candidateId);
    return this.toView(candidate);
  }

  /**
   * 选定一个候选题目作为最终题目
   */
  async selectTopic(
    taskId: string,
    candidateId: string,
  ): Promise<TopicCandidateView> {
    const task = await this.taskService.findById(taskId);
    this.assertCanSelectTopic(task);

    const candidate = await this.prisma.topicCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate || candidate.taskId !== taskId) {
      throw new TopicNotFoundException(candidateId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.topicCandidate.updateMany({
        where: { taskId, id: { not: candidateId } },
        data: { isSelected: false },
      });

      const selected = await tx.topicCandidate.update({
        where: { id: candidateId },
        data: { isSelected: true },
      });

      await tx.task.update({
        where: { id: taskId },
        data: { title: selected.title },
      });

      return selected;
    });

    await this.taskService.onStageCompleted(taskId, GenerationStage.TOPIC);
    await this.taskService.advanceStage(taskId, GenerationStage.OPENING);
    await this.taskService.recalculateProgress(taskId);

    this.logger.log(`题目已选定 taskId=${taskId} title=${updated.title}`);
    return this.toView(updated);
  }

  /**
   * 取消选定（清除 isSelected，但不回退任务阶段）
   */
  async unselectTopic(taskId: string): Promise<void> {
    await this.taskService.findById(taskId);
    await this.prisma.topicCandidate.updateMany({
      where: { taskId, isSelected: true },
      data: { isSelected: false },
    });
  }

  /**
   * 删除某轮生成的候选（仅未被选中的可删）
   */
  async deleteCandidatesByBatch(
    taskId: string,
    batch: number,
  ): Promise<number> {
    await this.taskService.findById(taskId);
    const candidates = await this.prisma.topicCandidate.findMany({
      where: { taskId, isSelected: false },
      select: { id: true, description: true },
    });

    const ids = candidates
      .filter((c) => parseMeta(c.description)?.generationBatch === batch)
      .map((c) => c.id);

    if (ids.length === 0) return 0;

    const result = await this.prisma.topicCandidate.deleteMany({
      where: { id: { in: ids } },
    });

    return result.count;
  }

  private async generateInternal(
    taskId: string,
    params: {
      count: number;
      additionalContext?: string;
      feedback?: string;
      rejectedTitles?: string[];
      preferredStyle?: string;
    },
  ): Promise<TopicCandidate[]> {
    const task = await this.taskService.findById(taskId);
    this.assertCanGenerateTopic(task);

    await this.assertCooldown(taskId);
    const nextBatch = await this.getNextBatch(taskId);

    const extracted = extractTopicKeywordsLanguage(task);
    const academicLevel = toAcademicLevel(task.educationLevel);

    const prompt = buildTopicGenerationPrompt({
      topic: extracted.topic,
      keywords: extracted.keywords,
      academicLevel,
      language: extracted.language,
      count: params.count,
      additionalContext: params.additionalContext,
      feedback: params.feedback,
      rejectedTitles: params.rejectedTitles,
      preferredStyle: params.preferredStyle,
    });

    let llmResult: LlmTopicOutput;
    try {
      llmResult = await this.llmService.generateJson<LlmTopicOutput>(
        prompt,
        TOPIC_GENERATION_ZOD_SCHEMA,
        {
          taskId,
          stage: 'TOPIC',
          temperature: 0.8,
          maxTokens: 2000,
        },
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'LLM generation failed';
      await this.taskService.onStageFailed(
        taskId,
        GenerationStage.TOPIC,
        message,
      );
      throw new TopicGenerationFailedException(taskId, message);
    }

    const deduped = uniqueCandidatesByTitle(llmResult.candidates ?? []).map(
      (c) => {
        return {
          title: normalizeTitle(c.title),
          rationale: truncateText(c.rationale, TOPIC_RATIONALE_MAX_LEN),
          keywords: Array.isArray(c.keywords) ? c.keywords.slice(0, 8) : [],
          estimatedDifficulty: c.estimatedDifficulty,
        };
      },
    );

    if (deduped.length < 3) {
      await this.taskService.onStageFailed(
        taskId,
        GenerationStage.TOPIC,
        '候选题目数量不足（少于 3 个）',
      );
      throw new TopicGenerationFailedException(
        taskId,
        '候选题目数量不足（少于 3 个）',
      );
    }

    const createInputs: Prisma.TopicCandidateCreateInput[] = deduped
      .slice(0, params.count)
      .map((c) => {
        const meta: TopicCandidateMetaV1 = {
          generationBatch: nextBatch,
          rationale: c.rationale,
          keywords: c.keywords,
          estimatedDifficulty: c.estimatedDifficulty,
        };

        return {
          task: { connect: { id: taskId } },
          title: c.title,
          description: buildDescription(meta),
          isSelected: false,
        };
      });

    const created = await this.prisma.$transaction(
      createInputs.map((data) => this.prisma.topicCandidate.create({ data })),
    );

    this.logger.log(
      `题目候选生成完成 taskId=${taskId} batch=${nextBatch} count=${created.length}`,
    );

    return created;
  }

  private assertCanGenerateTopic(task: Task): void {
    if (
      task.status === 'CANCELLED' ||
      task.status === 'DONE' ||
      task.status === 'FAILED'
    ) {
      throw new InvalidTaskStageException(
        `不能在状态 ${task.status} 下生成题目`,
      );
    }

    if (task.currentStage && task.currentStage !== 'TOPIC') {
      throw new InvalidTaskStageException(
        `不能在阶段 ${task.currentStage} 下生成题目，仅 TOPIC 阶段允许`,
      );
    }

    const extracted = extractTopicKeywordsLanguage(task);
    if (!extracted.topic || extracted.topic.trim().length === 0) {
      throw new InvalidTaskStageException('任务的 topic 为空，无法生成题目');
    }
  }

  private assertCanSelectTopic(task: Task): void {
    if (task.currentStage && task.currentStage !== 'TOPIC') {
      throw new InvalidTaskStageException(
        `Cannot select topic when task stage is ${task.currentStage}`,
      );
    }
  }

  private async getNextBatch(taskId: string): Promise<number> {
    const latest = await this.prisma.topicCandidate.findFirst({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      select: { description: true },
    });

    const current = latest
      ? parseMeta(latest.description)?.generationBatch
      : null;
    return (current ?? 0) + 1;
  }

  private async assertCooldown(taskId: string): Promise<void> {
    const latest = await this.prisma.topicCandidate.findFirst({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (!latest) return;

    const now = Date.now();
    const last = latest.createdAt.getTime();
    if (now - last < TOPIC_GENERATION_COOLDOWN_MS) {
      throw new ConflictException('生成过于频繁，请稍后重试');
    }
  }

  private toView(candidate: TopicCandidate): TopicCandidateView {
    const meta = parseMeta(candidate.description);
    return {
      id: candidate.id,
      taskId: candidate.taskId,
      title: candidate.title,
      rationale: meta?.rationale ?? candidate.description ?? null,
      keywords: meta?.keywords ?? [],
      estimatedDifficulty: meta?.estimatedDifficulty ?? null,
      isSelected: candidate.isSelected,
      selectedAt: null,
      generationBatch: meta?.generationBatch ?? 0,
      createdAt: candidate.createdAt,
    };
  }
}
