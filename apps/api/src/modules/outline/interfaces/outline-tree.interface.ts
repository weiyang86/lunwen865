import type { Outline, OutlineNode } from '@prisma/client';

export type OutlineRecord = Outline;
export type OutlineNodeRecord = OutlineNode;

export interface OutlineTreeNode extends OutlineNodeRecord {
  children: OutlineTreeNode[];
  numbering: string | null;
}

export interface OutlineTreeDto {
  outline: Outline;
  nodes: OutlineTreeNode[];
}
