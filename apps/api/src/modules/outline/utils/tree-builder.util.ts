import crypto from 'node:crypto';
import type { OutlineNodeType } from '@prisma/client';
import { nodeTypeByDepth } from '../constants/node-type.constants';
import type { LlmOutlineNode } from '../interfaces/llm-outline-schema.interface';
import type {
  OutlineNodeRecord,
  OutlineTreeNode,
} from '../interfaces/outline-tree.interface';
import { buildPath } from './path-builder.util';

function makeId(): string {
  return crypto.randomUUID();
}

/**
 * 把扁平 OutlineNode[] 构建为嵌套树
 */
export function buildTree(nodes: OutlineNodeRecord[]): OutlineTreeNode[] {
  const byId = new Map<string, OutlineTreeNode>();
  const roots: OutlineTreeNode[] = [];

  for (const n of nodes) {
    byId.set(n.id, { ...n, children: [], numbering: null });
  }

  for (const n of nodes) {
    const current = byId.get(n.id);
    if (!current) continue;
    if (!n.parentId) {
      roots.push(current);
      continue;
    }
    const parent = byId.get(n.parentId);
    if (!parent) {
      roots.push(current);
      continue;
    }
    parent.children.push(current);
  }

  const sortRec = (arr: OutlineTreeNode[]) => {
    arr.sort((a, b) => a.path.localeCompare(b.path));
    for (const item of arr) sortRec(item.children);
  };
  sortRec(roots);

  return roots;
}

type OutlineNodeCreateManyInputCompat = Omit<
  {
    outlineId: string;
    parentId: string | null;
    nodeType: OutlineNodeType;
    depth: number;
    orderIndex: number;
    path: string;
    title: string;
    summary: string;
    expectedWords: number;
    isLeaf: boolean;
  },
  never
> & { id: string };

/**
 * 递归遍历嵌套 LLM 响应，转为扁平 OutlineNode 入库数据
 * 返回数组顺序即为创建顺序
 */
export function flattenLlmTree(
  llmChapters: LlmOutlineNode[],
  outlineId: string,
  maxDepth: number,
): Array<OutlineNodeCreateManyInputCompat> {
  const result: Array<OutlineNodeCreateManyInputCompat> = [];

  const walk = (
    nodes: LlmOutlineNode[],
    parentId: string | null,
    parentPath: string | null,
    depth: number,
  ) => {
    if (depth > maxDepth) {
      throw new Error(`LLM returned depth=${depth} > maxDepth=${maxDepth}`);
    }

    nodes.forEach((node, index) => {
      const id = makeId();
      const orderIndex = index;
      const path = buildPath(parentPath, orderIndex);

      const hasChildren =
        Array.isArray(node.children) && node.children.length > 0;
      const isLeaf = !hasChildren;

      result.push({
        id,
        outlineId,
        parentId,
        nodeType: nodeTypeByDepth(depth),
        depth,
        orderIndex,
        path,
        title: node.title,
        summary: node.summary,
        expectedWords: isLeaf ? (node.expectedWords ?? 0) : 0,
        isLeaf,
      });

      if (hasChildren) {
        walk(node.children ?? [], id, path, depth + 1);
      }
    });
  };

  walk(llmChapters, null, null, 1);
  return result;
}
