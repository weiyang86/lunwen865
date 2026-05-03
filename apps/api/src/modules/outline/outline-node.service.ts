import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Outline, OutlineNode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskService } from '../task/task.service';
import { OutlineLockedException } from './exceptions/outline-locked.exception';
import { OutlineNotFoundException } from './exceptions/outline-not-found.exception';
import { InvalidTreeStructureException } from './exceptions/invalid-tree-structure.exception';
import type { CreateNodeDto } from './dto/create-node.dto';
import type { MoveNodeDto } from './dto/move-node.dto';
import type { RegenerateSectionDto } from './dto/regenerate-section.dto';
import type { UpdateNodeDto } from './dto/update-node.dto';
import { nodeTypeByDepth } from './constants/node-type.constants';
import { buildPath } from './utils/path-builder.util';
import { OutlineGeneratorService } from './outline-generator.service';
import { OutlineValidatorService } from './outline-validator.service';
import type { AcademicLevel } from './prompts/outline-generation.prompt';

type OutlineModel = Pick<Outline, 'id' | 'taskId' | 'locked' | 'maxDepth'>;

function toAcademicLevel(educationLevel: string): AcademicLevel {
  if (educationLevel.includes('博士')) return 'DOCTOR';
  if (educationLevel.includes('硕士') || educationLevel.includes('研究生'))
    return 'MASTER';
  return 'UNDERGRADUATE';
}

function extractTopicKeywords(task: { requirements: string | null }): {
  topic: string;
  keywords: string[];
} {
  const fallback = { topic: (task.requirements ?? '').trim(), keywords: [] };
  if (!task.requirements) return fallback;

  try {
    const parsed = JSON.parse(task.requirements) as unknown;
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

@Injectable()
export class OutlineNodeService {
  private readonly logger = new Logger(OutlineNodeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
    private readonly validator: OutlineValidatorService,
    private readonly generator: OutlineGeneratorService,
  ) {}

  async createNode(taskId: string, dto: CreateNodeDto): Promise<OutlineNode> {
    const outline = await this.assertNotLocked(taskId);

    const parent = dto.parentId
      ? await this.prisma.outlineNode.findUnique({
          where: { id: dto.parentId },
          select: {
            id: true,
            outlineId: true,
            parentId: true,
            nodeType: true,
            depth: true,
            orderIndex: true,
            path: true,
            title: true,
            summary: true,
            expectedWords: true,
            numbering: true,
            isLeaf: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : null;

    if (dto.parentId && (!parent || parent.outlineId !== outline.id)) {
      throw new BadRequestException('parentId 不存在或不属于该任务的大纲');
    }

    const depth = (parent?.depth ?? 0) + 1;
    this.validator.validateNodeCreation(parent, depth, outline.maxDepth);

    const siblings = await this.prisma.outlineNode.findMany({
      where: { outlineId: outline.id, parentId: parent?.id ?? null },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, orderIndex: true, path: true },
    });

    const requestedOrder =
      typeof dto.orderIndex === 'number'
        ? Math.max(0, Math.min(dto.orderIndex, siblings.length))
        : siblings.length;

    return this.prisma.$transaction(async (tx) => {
      if (siblings.length > 0) {
        await tx.outlineNode.updateMany({
          where: {
            outlineId: outline.id,
            parentId: parent?.id ?? null,
            orderIndex: { gte: requestedOrder },
          },
          data: { orderIndex: { increment: 1 } },
        });
      }

      const created = await tx.outlineNode.create({
        data: {
          outlineId: outline.id,
          parentId: parent?.id ?? null,
          nodeType: dto.nodeType,
          depth,
          orderIndex: requestedOrder,
          path: buildPath(parent?.path ?? null, requestedOrder),
          title: dto.title.trim(),
          summary: dto.summary?.trim() ?? null,
          expectedWords: 0,
          isLeaf: true,
        },
      });

      await this.rebuildPaths(tx, outline.id, parent?.id ?? null);
      await this.rebuildIsLeafFlags(tx, outline.id);

      return created;
    });
  }

  async updateNode(
    taskId: string,
    nodeId: string,
    dto: UpdateNodeDto,
  ): Promise<OutlineNode> {
    const outline = await this.assertNotLocked(taskId);
    const node = await this.findNode(outline.id, nodeId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.outlineNode.update({
        where: { id: node.id },
        data: {
          title: dto.title?.trim(),
          summary: dto.summary?.trim(),
          expectedWords:
            typeof dto.expectedWords === 'number'
              ? Math.max(0, dto.expectedWords)
              : undefined,
        },
      });

      await this.rebuildIsLeafFlags(tx, outline.id);
      return updated;
    });
  }

  async deleteNode(taskId: string, nodeId: string): Promise<void> {
    const outline = await this.assertNotLocked(taskId);
    const node = await this.findNode(outline.id, nodeId);

    await this.prisma.$transaction(async (tx) => {
      await tx.outlineNode.delete({ where: { id: node.id } });
      await this.rebuildPaths(tx, outline.id, node.parentId);
      await this.rebuildIsLeafFlags(tx, outline.id);
    });
  }

  async moveNode(
    taskId: string,
    nodeId: string,
    dto: MoveNodeDto,
  ): Promise<OutlineNode> {
    const outline = await this.assertNotLocked(taskId);
    const node = await this.findNode(outline.id, nodeId);

    if (dto.newParentId) {
      await this.assertNotDescendant(nodeId, dto.newParentId);
    }

    const newParent = dto.newParentId
      ? await this.findNode(outline.id, dto.newParentId)
      : null;

    const newDepth = (newParent?.depth ?? 0) + 1;
    const subtreeDepths = await this.prisma.outlineNode.findMany({
      where: { outlineId: outline.id, path: { startsWith: node.path } },
      select: { depth: true },
    });
    const subtreeMaxDepth = subtreeDepths.reduce(
      (m, x) => Math.max(m, x.depth),
      node.depth,
    );

    if (newDepth + (subtreeMaxDepth - node.depth) > outline.maxDepth) {
      throw new InvalidTreeStructureException('Move would exceed max depth');
    }

    this.validator.validateMoveOperation(node, newParent, outline.maxDepth);

    const oldParentId = node.parentId;
    const oldOrderIndex = node.orderIndex;

    return this.prisma.$transaction(async (tx) => {
      await tx.outlineNode.updateMany({
        where: {
          outlineId: outline.id,
          parentId: oldParentId,
          orderIndex: { gt: oldOrderIndex },
        },
        data: { orderIndex: { decrement: 1 } },
      });

      await tx.outlineNode.updateMany({
        where: {
          outlineId: outline.id,
          parentId: dto.newParentId ?? null,
          orderIndex: { gte: dto.newOrderIndex },
        },
        data: { orderIndex: { increment: 1 } },
      });

      const updatedNode = await tx.outlineNode.update({
        where: { id: node.id },
        data: {
          parentId: dto.newParentId ?? null,
          orderIndex: dto.newOrderIndex,
          depth: newDepth,
          nodeType: nodeTypeByDepth(newDepth),
        },
      });

      await this.rebuildSubtreePathsAndDepths(
        tx,
        outline.id,
        node.id,
        oldParentId,
      );

      await this.rebuildPaths(tx, outline.id, oldParentId);
      await this.rebuildPaths(tx, outline.id, dto.newParentId ?? null);
      await this.rebuildIsLeafFlags(tx, outline.id);

      return updatedNode;
    });
  }

  async regenerateSection(
    taskId: string,
    nodeId: string,
    dto: RegenerateSectionDto,
  ): Promise<OutlineNode> {
    const outline = await this.assertNotLocked(taskId);
    const node = await this.findNode(outline.id, nodeId);

    const task = await this.taskService.findById(taskId);
    const opening = await this.prisma.openingReport.findFirst({
      where: { taskId, status: 'COMPLETED' },
      orderBy: { version: 'desc' },
      select: { fullContent: true },
    });

    if (!opening?.fullContent) {
      throw new BadRequestException('开题报告未完成或缺少 fullContent');
    }

    const extracted = extractTopicKeywords({ requirements: task.requirements });
    const academicLevel = toAcademicLevel(task.educationLevel);
    const targetWordCount = task.totalWordCount ?? 0;
    if (!Number.isInteger(targetWordCount) || targetWordCount <= 0) {
      throw new BadRequestException('任务未设置目标字数');
    }

    const allNodes = await this.prisma.outlineNode.findMany({
      where: { outlineId: outline.id },
      orderBy: { path: 'asc' },
      select: { title: true, summary: true, path: true, depth: true },
    });
    const skeleton = allNodes
      .map((n) => `${n.path} ${n.title}（${n.depth}）`)
      .join('\n');

    const siblings = await this.prisma.outlineNode.findMany({
      where: {
        outlineId: outline.id,
        parentId: node.parentId,
        id: { not: node.id },
      },
      orderBy: { orderIndex: 'asc' },
      select: { title: true, summary: true },
    });

    const llmNode = await this.generator.regenerateSubtree(node, {
      taskId,
      paperTitle: task.title ?? '',
      topic: extracted.topic,
      keywords: extracted.keywords,
      academicLevel,
      targetWordCount,
      outlineMaxDepth: outline.maxDepth,
      currentNodeTitle: node.title,
      currentNodeSummary: node.summary ?? undefined,
      currentNodeDepth: node.depth,
      siblings: siblings.map((s) => ({
        title: s.title,
        summary: s.summary ?? '',
      })),
      outlineSkeleton: skeleton,
      feedback: dto.feedback,
      additionalRequirements: dto.additionalRequirements,
      model: dto.model,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
      maxRetries: dto.maxRetries,
      timeout: dto.timeout,
    });

    return this.prisma.$transaction(async (tx) => {
      const descendants = await tx.outlineNode.findMany({
        where: {
          outlineId: outline.id,
          path: { startsWith: `${node.path}/` },
        },
        select: { id: true },
      });

      if (descendants.length > 0) {
        await tx.outlineNode.deleteMany({
          where: { id: { in: descendants.map((d) => d.id) } },
        });
      }

      await tx.outlineNode.update({
        where: { id: node.id },
        data: {
          title: llmNode.title.trim(),
          summary: llmNode.summary.trim(),
        },
      });

      if (Array.isArray(llmNode.children) && llmNode.children.length > 0) {
        const createdInputs: Prisma.OutlineNodeCreateManyInput[] = [];
        llmNode.children.forEach((child, idx) => {
          createdInputs.push({
            outlineId: outline.id,
            parentId: node.id,
            nodeType: nodeTypeByDepth(node.depth + 1),
            depth: node.depth + 1,
            orderIndex: idx,
            path: buildPath(node.path, idx),
            title: child.title.trim(),
            summary: child.summary.trim(),
            expectedWords:
              typeof child.expectedWords === 'number' ? child.expectedWords : 0,
            isLeaf: !child.children || child.children.length === 0,
          });
        });

        await tx.outlineNode.createMany({ data: createdInputs });
      }

      await this.rebuildPaths(tx, outline.id, node.id);
      await this.rebuildIsLeafFlags(tx, outline.id);

      const refreshed = await tx.outlineNode.findUnique({
        where: { id: node.id },
      });
      if (!refreshed) throw new InvalidTreeStructureException('节点不存在');
      return refreshed;
    });
  }

  private async assertNotLocked(taskId: string): Promise<OutlineModel> {
    const outline = await this.prisma.outline.findUnique({
      where: { taskId },
      select: { id: true, taskId: true, locked: true, maxDepth: true },
    });
    if (!outline) throw new OutlineNotFoundException(taskId);
    if (outline.locked) throw new OutlineLockedException(taskId);
    return outline;
  }

  private async findNode(
    outlineId: string,
    nodeId: string,
  ): Promise<OutlineNode> {
    const node = await this.prisma.outlineNode.findUnique({
      where: { id: nodeId },
    });
    if (!node || node.outlineId !== outlineId) {
      throw new BadRequestException('节点不存在或不属于该大纲');
    }
    return node;
  }

  private async assertNotDescendant(
    nodeId: string,
    candidateAncestorId: string,
  ): Promise<void> {
    if (nodeId === candidateAncestorId) {
      throw new BadRequestException('不能将节点移动到自身之下');
    }

    const [node, candidate] = await Promise.all([
      this.prisma.outlineNode.findUnique({
        where: { id: nodeId },
        select: { path: true, outlineId: true },
      }),
      this.prisma.outlineNode.findUnique({
        where: { id: candidateAncestorId },
        select: { path: true, outlineId: true },
      }),
    ]);

    if (!node || !candidate) throw new BadRequestException('节点不存在');
    if (node.outlineId !== candidate.outlineId) {
      throw new BadRequestException('节点不属于同一大纲');
    }

    if (candidate.path === node.path) {
      throw new BadRequestException('不能将节点移动到自身之下');
    }
    if (candidate.path.startsWith(`${node.path}/`)) {
      throw new BadRequestException('不能将节点移动到自身的后代节点下');
    }
  }

  private async rebuildPaths(
    tx: Prisma.TransactionClient,
    outlineId: string,
    parentId: string | null,
  ): Promise<void> {
    const parent = parentId
      ? await tx.outlineNode.findUnique({
          where: { id: parentId },
          select: { path: true },
        })
      : null;

    const parentPath = parent?.path ?? null;

    const children = await tx.outlineNode.findMany({
      where: { outlineId, parentId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });

    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      const newOrder = i;
      const newPath = buildPath(parentPath, newOrder);
      const needsUpdate =
        child.orderIndex !== newOrder || child.path !== newPath;

      if (needsUpdate) {
        await tx.outlineNode.update({
          where: { id: child.id },
          data: { orderIndex: newOrder, path: newPath },
        });
      }

      await this.rebuildPaths(tx, outlineId, child.id);
    }
  }

  private async rebuildSubtreePathsAndDepths(
    tx: Prisma.TransactionClient,
    outlineId: string,
    nodeId: string,
    oldParentId: string | null,
  ): Promise<void> {
    const moved = await tx.outlineNode.findUnique({
      where: { id: nodeId },
      select: {
        id: true,
        parentId: true,
        orderIndex: true,
        depth: true,
        path: true,
      },
    });
    if (!moved) return;

    const oldParent = oldParentId
      ? await tx.outlineNode.findUnique({
          where: { id: oldParentId },
          select: { path: true, depth: true },
        })
      : null;
    const newParent = moved.parentId
      ? await tx.outlineNode.findUnique({
          where: { id: moved.parentId },
          select: { path: true, depth: true },
        })
      : null;

    const oldPrefix = buildPath(oldParent?.path ?? null, moved.orderIndex);
    const newPrefix = buildPath(newParent?.path ?? null, moved.orderIndex);

    const depthDelta = (newParent?.depth ?? 0) + 1 - moved.depth;

    const subtree = await tx.outlineNode.findMany({
      where: { outlineId, path: { startsWith: moved.path } },
      orderBy: { path: 'asc' },
      select: { id: true, path: true, depth: true },
    });

    for (const item of subtree) {
      const suffix = item.path.slice(moved.path.length);
      const newPath = `${newPrefix}${suffix}`;
      const newDepth = item.depth + depthDelta;
      await tx.outlineNode.update({
        where: { id: item.id },
        data: {
          path: newPath,
          depth: newDepth,
          nodeType: nodeTypeByDepth(newDepth),
        },
      });
    }

    if (oldPrefix !== moved.path) {
      this.logger.warn(
        `移动节点 path 前缀不一致 oldPrefix=${oldPrefix} actual=${moved.path}`,
      );
    }
  }

  private async rebuildIsLeafFlags(
    tx: Prisma.TransactionClient,
    outlineId: string,
  ): Promise<void> {
    const nodes = await tx.outlineNode.findMany({
      where: { outlineId },
      select: { id: true, parentId: true, expectedWords: true },
    });

    const childCount = new Map<string, number>();
    for (const n of nodes) {
      if (!n.parentId) continue;
      childCount.set(n.parentId, (childCount.get(n.parentId) ?? 0) + 1);
    }

    for (const n of nodes) {
      const hasChildren = (childCount.get(n.id) ?? 0) > 0;
      const shouldLeaf = !hasChildren;

      await tx.outlineNode.update({
        where: { id: n.id },
        data: {
          isLeaf: shouldLeaf,
          expectedWords: shouldLeaf ? n.expectedWords : 0,
        },
      });
    }
  }
}
