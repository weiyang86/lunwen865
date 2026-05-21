import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AbstractStatus,
  TaskAbstractRevisionType,
  TaskStage,
  TaskStatus,
} from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { TaskService } from '../task/task.service';
import { GenerationStage } from '../task/constants/generation-stage.enum';
import type { GenerateAbstractDto } from './dto/generate-abstract.dto';
import type { UpdateAbstractDto } from './dto/update-abstract.dto';
import { buildAbstractGenerationPrompt } from './prompts/abstract-generation.prompt';

function extractTopic(requirements: string | null): string {
  const raw = (requirements ?? '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return raw;
    const obj = parsed as { topic?: unknown; title?: unknown };
    if (typeof obj.topic === 'string' && obj.topic.trim())
      return obj.topic.trim();
    if (typeof obj.title === 'string' && obj.title.trim())
      return obj.title.trim();
    return raw;
  } catch {
    return raw;
  }
}

function buildOutlineText(
  nodes: Array<{
    depth: number;
    orderIndex: number;
    numbering: string | null;
    title: string;
  }>,
): string {
  const filtered = nodes
    .filter((n) => n.depth >= 1 && n.depth <= 3)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return filtered
    .map((n) => {
      const prefix = n.numbering ? `${n.numbering} ` : '';
      const indent = '  '.repeat(Math.max(0, n.depth - 1));
      return `${indent}${prefix}${n.title}`.trimEnd();
    })
    .join('\n');
}

const ABSTRACT_SCHEMA = z.object({
  abstractZh: z.string().min(50),
  abstractEn: z.string().min(50),
});

@Injectable()
export class AbstractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
    private readonly llm: LlmService,
  ) {}

  async getLatest(taskId: string) {
    const latest = await this.prisma.taskAbstract.findFirst({
      where: { taskId },
      orderBy: { version: 'desc' },
    });
    if (!latest) throw new NotFoundException('摘要不存在');
    return latest;
  }

  async getHistory(taskId: string) {
    const versions = await this.prisma.taskAbstract.findMany({
      where: { taskId },
      orderBy: { version: 'desc' },
    });
    const revisions = await this.prisma.taskAbstractRevision.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });

    const generateCount = revisions.filter(
      (r) => r.type === TaskAbstractRevisionType.GENERATE,
    ).length;
    const rewriteCount = revisions.filter(
      (r) => r.type === TaskAbstractRevisionType.REWRITE,
    ).length;
    const manualEditCount = revisions.filter(
      (r) => r.type === TaskAbstractRevisionType.MANUAL_EDIT,
    ).length;

    return {
      versions,
      revisions,
      stats: {
        generateCount,
        rewriteCount,
        manualEditCount,
        total: revisions.length,
      },
    };
  }

  async generate(taskId: string, dto: GenerateAbstractDto) {
    const task = await this.taskService.findById(taskId);
    if (task.currentStage === TaskStage.TOPIC) {
      throw new BadRequestException('请先完成开题报告与目录/大纲');
    }

    const outline = await this.prisma.outline.findUnique({
      where: { taskId },
      include: {
        nodes: {
          select: {
            depth: true,
            orderIndex: true,
            numbering: true,
            title: true,
          },
        },
      },
    });
    if (!outline) throw new BadRequestException('目录/大纲不存在');
    if (!outline.locked) throw new BadRequestException('请先锁定目录/大纲');

    const latest = await this.prisma.taskAbstract.findFirst({
      where: { taskId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    await this.taskService.advanceStage(taskId, GenerationStage.SUMMARY);

    const created = await this.prisma.taskAbstract.create({
      data: {
        taskId,
        status: AbstractStatus.GENERATING,
        feedback: dto.feedback?.trim() ? dto.feedback.trim() : null,
        llmModel: dto.model ?? null,
        version: nextVersion,
      },
    });

    const revision = await this.prisma.taskAbstractRevision.create({
      data: {
        taskId,
        abstractId: created.id,
        type: latest
          ? TaskAbstractRevisionType.REWRITE
          : TaskAbstractRevisionType.GENERATE,
        feedback: dto.feedback?.trim() ? dto.feedback.trim() : null,
        fromVersion: latest?.version ?? null,
        toVersion: nextVersion,
        beforeZh: latest?.abstractZh ?? null,
        beforeEn: latest?.abstractEn ?? null,
        afterZh: null,
        afterEn: null,
      },
    });

    const startedAt = Date.now();
    try {
      const prompt = buildAbstractGenerationPrompt({
        title: task.title ?? '',
        topic: extractTopic(task.requirements),
        outlineText: buildOutlineText(outline.nodes ?? []),
        wordCountTarget: task.totalWordCount ?? null,
        previousZh: latest?.abstractZh ?? null,
        previousEn: latest?.abstractEn ?? null,
        feedback: dto.feedback ?? null,
      });

      const res = await this.llm.generateJson(prompt, ABSTRACT_SCHEMA, {
        taskId,
        stage: 'SUMMARY',
        targetId: created.id,
        model: dto.model,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
        maxRetries: dto.maxRetries,
        timeout: dto.timeout,
      });

      const updated = await this.prisma.taskAbstract.update({
        where: { id: created.id },
        data: {
          status: AbstractStatus.COMPLETED,
          abstractZh: res.abstractZh.trim(),
          abstractEn: res.abstractEn.trim(),
          durationMs: Date.now() - startedAt,
        },
      });

      await this.prisma.taskAbstractRevision.update({
        where: { id: revision.id },
        data: {
          afterZh: updated.abstractZh ?? null,
          afterEn: updated.abstractEn ?? null,
        },
      });

      await this.prisma.task.updateMany({
        where: {
          id: taskId,
          status: { notIn: [TaskStatus.CANCELLED, TaskStatus.DONE] },
        },
        data: { status: TaskStatus.ABSTRACT_PENDING_REVIEW },
      });
      return updated;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '摘要生成失败';
      await this.prisma.taskAbstract.update({
        where: { id: created.id },
        data: {
          status: AbstractStatus.FAILED,
          errorMessage: message.slice(0, 2000),
          durationMs: Date.now() - startedAt,
        },
      });
      throw new BadRequestException(message);
    }
  }

  async updateManually(taskId: string, dto: UpdateAbstractDto) {
    const zh = dto.abstractZh?.trim() ?? '';
    const en = dto.abstractEn?.trim() ?? '';
    if (!zh && !en) throw new BadRequestException('请输入中文或英文摘要');

    const latest = await this.prisma.taskAbstract.findFirst({
      where: { taskId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    await this.taskService.advanceStage(taskId, GenerationStage.SUMMARY);
    const created = await this.prisma.taskAbstract.create({
      data: {
        taskId,
        status: AbstractStatus.COMPLETED,
        abstractZh: zh || null,
        abstractEn: en || null,
        llmModel: 'manual',
        version: nextVersion,
      },
    });

    await this.prisma.taskAbstractRevision.create({
      data: {
        taskId,
        abstractId: created.id,
        type: TaskAbstractRevisionType.MANUAL_EDIT,
        feedback: null,
        fromVersion: latest?.version ?? null,
        toVersion: nextVersion,
        beforeZh: latest?.abstractZh ?? null,
        beforeEn: latest?.abstractEn ?? null,
        afterZh: created.abstractZh ?? null,
        afterEn: created.abstractEn ?? null,
      },
    });

    await this.prisma.task.updateMany({
      where: {
        id: taskId,
        status: { notIn: [TaskStatus.CANCELLED, TaskStatus.DONE] },
      },
      data: { status: TaskStatus.ABSTRACT_PENDING_REVIEW },
    });
    return created;
  }

  async confirm(taskId: string) {
    const latest = await this.prisma.taskAbstract.findFirst({
      where: { taskId },
      orderBy: { version: 'desc' },
      select: { id: true, status: true },
    });
    if (!latest) throw new NotFoundException('摘要不存在');
    if (latest.status !== AbstractStatus.COMPLETED)
      throw new BadRequestException('摘要未生成完成，无法确认');

    await this.taskService.onStageCompleted(taskId, GenerationStage.SUMMARY);
    const updated = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!updated) throw new NotFoundException('任务不存在');
    return updated;
  }
}
