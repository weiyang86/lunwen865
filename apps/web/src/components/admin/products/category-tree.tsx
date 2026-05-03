'use client';

import { useMemo, useState } from 'react';
import type { Category } from '@/types/admin/category';
import { CategoryNode } from './category-node';

type DragIndicator = { overId: string; position: 'before' | 'after' } | null;

interface Props {
  tree: Category[];
  selectedId: string | undefined;
  expandedIds: Set<string>;
  highlight?: string;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string | undefined) => void;
  getNodeDepth: (id: string) => number;
  onAdd: (parent: Category | null) => void;
  onEdit: (node: Category) => void;
  onDelete: (node: Category) => void;
  onReorder: (parentId: string | null, orderedIds: string[]) => void;
  disableDeleteReason: (node: Category) => string | null;
}

function buildParentIndex(tree: Category[]) {
  const parent = new Map<string, string | null>();
  const dfs = (nodes: Category[], parentId: string | null) => {
    for (const n of nodes) {
      parent.set(n.id, parentId);
      if (n.children?.length) dfs(n.children, n.id);
    }
  };
  dfs(tree, null);
  return parent;
}

function getSiblings(tree: Category[], parentId: string | null) {
  if (parentId == null) return tree;
  const stack: Category[] = [...tree];
  while (stack.length) {
    const cur = stack.shift()!;
    if (cur.id === parentId) return cur.children ?? [];
    if (cur.children?.length) stack.push(...cur.children);
  }
  return [];
}

function reorderIds(ids: string[], dragId: string, overId: string, position: 'before' | 'after') {
  const next = ids.filter((x) => x !== dragId);
  const idx = next.indexOf(overId);
  const insertAt = position === 'before' ? idx : idx + 1;
  next.splice(insertAt < 0 ? next.length : insertAt, 0, dragId);
  return next;
}

export function CategoryTree({
  tree,
  selectedId,
  expandedIds,
  highlight,
  onToggleExpand,
  onSelect,
  getNodeDepth,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  disableDeleteReason,
}: Props) {
  const parentIndex = useMemo(() => buildParentIndex(tree), [tree]);
  const [dragging, setDragging] = useState<{ id: string; parentId: string | null } | null>(null);
  const [indicator, setIndicator] = useState<DragIndicator>(null);

  const renderNodes = (nodes: Category[], depth: number) => {
    return (
      <div className={depth > 0 ? 'ml-4' : ''}>
        {nodes.map((n) => {
          const hasChildren = Boolean(n.children && n.children.length > 0);
          const expanded = expandedIds.has(n.id);
          const selected = selectedId === n.id;
          const nodeDepth = getNodeDepth(n.id);
          const disableAddChild = nodeDepth >= 3;
          const disableDelete = disableDeleteReason(n);
          const dragIndicator =
            indicator && indicator.overId === n.id ? indicator.position : 'none';

          return (
            <div key={n.id}>
              <CategoryNode
                node={n}
                depth={depth}
                expanded={expanded}
                hasChildren={hasChildren}
                selected={selected}
                highlight={highlight}
                disableAddChild={disableAddChild}
                disableDeleteReason={disableDelete}
                onToggleExpand={() => onToggleExpand(n.id)}
                onSelect={() => onSelect(n.id)}
                onAddChild={() => onAdd(n)}
                onEdit={() => onEdit(n)}
                onDelete={() => onDelete(n)}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  const parentId = parentIndex.get(n.id) ?? null;
                  setDragging({ id: n.id, parentId });
                }}
                onDragOver={(e) => {
                  if (!dragging) return;
                  const parentId = parentIndex.get(n.id) ?? null;
                  if (parentId !== dragging.parentId) return;
                  if (n.id === dragging.id) return;
                  e.preventDefault();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const before = e.clientY - rect.top < rect.height / 2;
                  setIndicator({ overId: n.id, position: before ? 'before' : 'after' });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragging || !indicator) return;
                  const parentId = parentIndex.get(indicator.overId) ?? null;
                  if (parentId !== dragging.parentId) return;
                  const siblings = getSiblings(tree, parentId);
                  const orderedIds = reorderIds(
                    siblings.map((s) => s.id),
                    dragging.id,
                    indicator.overId,
                    indicator.position,
                  );
                  setIndicator(null);
                  setDragging(null);
                  onReorder(parentId, orderedIds);
                }}
                dragIndicator={dragIndicator}
              />

              {hasChildren && expanded ? renderNodes(n.children ?? [], depth + 1) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      onDragEnd={() => {
        setIndicator(null);
        setDragging(null);
      }}
    >
      <div className="mb-1">
        <button
          type="button"
          onClick={() => onSelect(undefined)}
          className={`flex h-9 w-full items-center rounded-md px-2 text-sm ${
            selectedId === undefined ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
          }`}
        >
          全部商品
        </button>
      </div>
      {renderNodes(tree, 0)}
    </div>
  );
}
