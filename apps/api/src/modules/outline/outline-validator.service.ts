import { Injectable } from '@nestjs/common';
import type {
  OutlineNodeRecord,
  OutlineRecord,
} from './interfaces/outline-tree.interface';
import { InvalidTreeStructureException } from './exceptions/invalid-tree-structure.exception';
import { WordCountMismatchException } from './exceptions/word-count-mismatch.exception';
import { validateWordCount } from './utils/word-allocator.util';
import {
  nodeTypeByDepth,
  validateParentChildType,
} from './constants/node-type.constants';

type OutlineWithNodes = OutlineRecord & { nodes: OutlineNodeRecord[] };

@Injectable()
export class OutlineValidatorService {
  /**
   * 锁定前校验：结构合法 + 叶子字数满足阈值
   */
  validateForLock(outline: OutlineWithNodes, target: number): void {
    if (!Number.isInteger(target) || target <= 0) {
      throw new WordCountMismatchException('targetWordCount 不合法');
    }

    const nodes = outline.nodes ?? [];
    if (nodes.length === 0) {
      throw new InvalidTreeStructureException('大纲节点为空');
    }

    this.assertNoCycles(nodes);

    let leafSum = 0;
    for (const n of nodes) {
      if (n.depth < 1) {
        throw new InvalidTreeStructureException(
          `节点 depth 不合法: ${n.depth}`,
        );
      }

      const expectedType = nodeTypeByDepth(n.depth);
      if (n.nodeType !== expectedType) {
        throw new InvalidTreeStructureException(
          `节点类型与 depth 不匹配: depth=${n.depth} nodeType=${n.nodeType}`,
        );
      }

      if (n.isLeaf) {
        if (!Number.isInteger(n.expectedWords) || n.expectedWords < 0) {
          throw new InvalidTreeStructureException(
            `叶子节点 expectedWords 不合法: ${n.expectedWords}`,
          );
        }
        leafSum += n.expectedWords;
      } else {
        if (n.expectedWords !== 0) {
          throw new InvalidTreeStructureException(
            '非叶子节点 expectedWords 必须为 0',
          );
        }
      }
    }

    const res = validateWordCount(leafSum, target);
    if (!res.valid) {
      throw new WordCountMismatchException(res.reason ?? '字数不满足要求');
    }
  }

  /**
   * 新增节点校验：深度上限 + 父子类型合法
   */
  validateNodeCreation(
    parent: OutlineNodeRecord | null,
    depth: number,
    maxDepth: number,
  ): void {
    if (!Number.isInteger(depth) || depth < 1) {
      throw new InvalidTreeStructureException(`depth 不合法: ${depth}`);
    }

    if (!Number.isInteger(maxDepth) || maxDepth < 1) {
      throw new InvalidTreeStructureException(`maxDepth 不合法: ${maxDepth}`);
    }

    if (depth > maxDepth) {
      throw new InvalidTreeStructureException('新增节点会超过最大深度限制');
    }

    const parentType = parent ? parent.nodeType : null;
    const childType = nodeTypeByDepth(depth);

    if (!validateParentChildType(parentType, childType)) {
      throw new InvalidTreeStructureException('父子节点类型不合法');
    }
  }

  /**
   * 移动节点校验：深度上限 + 父子类型合法（循环引用由 NodeService 做强校验）
   */
  validateMoveOperation(
    node: OutlineNodeRecord,
    newParent: OutlineNodeRecord | null,
    maxDepth: number,
  ): void {
    if (!Number.isInteger(maxDepth) || maxDepth < 1) {
      throw new InvalidTreeStructureException(`maxDepth 不合法: ${maxDepth}`);
    }

    const newDepth = (newParent?.depth ?? 0) + 1;
    if (newDepth > maxDepth) {
      throw new InvalidTreeStructureException('移动后会超过最大深度限制');
    }

    const parentType = newParent ? newParent.nodeType : null;
    const expectedChildType = nodeTypeByDepth(newDepth);

    if (!validateParentChildType(parentType, expectedChildType)) {
      throw new InvalidTreeStructureException('移动后的父子节点类型不合法');
    }
  }

  private assertNoCycles(nodes: OutlineNodeRecord[]): void {
    const parentById = new Map<string, string | null>();
    for (const n of nodes) parentById.set(n.id, n.parentId ?? null);

    for (const n of nodes) {
      const seen = new Set<string>();
      let current: string | null = n.id;
      while (current) {
        if (seen.has(current)) {
          throw new InvalidTreeStructureException('检测到循环引用');
        }
        seen.add(current);
        current = parentById.get(current) ?? null;
      }
    }
  }
}
