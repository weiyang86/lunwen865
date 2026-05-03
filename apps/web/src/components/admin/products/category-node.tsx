'use client';

import { ChevronDown, ChevronRight, Folder, Plus, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/admin/category';

interface Props {
  node: Category;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  selected: boolean;
  highlight?: string;
  disableAddChild: boolean;
  disableDeleteReason: string | null;
  onToggleExpand: () => void;
  onSelect: () => void;
  onAddChild: () => void;
  onEdit: () => void;
  onDelete: () => void;
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  dragIndicator: 'none' | 'before' | 'after';
}

export function CategoryNode({
  node,
  depth,
  expanded,
  hasChildren,
  selected,
  highlight,
  disableAddChild,
  disableDeleteReason,
  onToggleExpand,
  onSelect,
  onAddChild,
  onEdit,
  onDelete,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  dragIndicator,
}: Props) {
  const Icon = Folder;
  const k = highlight?.trim() || '';
  const idx = k ? node.name.toLowerCase().indexOf(k.toLowerCase()) : -1;
  const nameView =
    idx >= 0 ? (
      <>
        <span className="truncate">
          {node.name.slice(0, idx)}
          <span className="rounded bg-amber-100 px-0.5 text-amber-800">
            {node.name.slice(idx, idx + k.length)}
          </span>
          {node.name.slice(idx + k.length)}
        </span>
      </>
    ) : (
      <span className="truncate">{node.name}</span>
    );

  return (
    <div
      className={cn(
        'group relative flex h-9 items-center gap-2 rounded-md px-2 text-sm',
        selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50',
        dragIndicator === 'before' ? 'border-t-2 border-indigo-500' : '',
        dragIndicator === 'after' ? 'border-b-2 border-indigo-500' : '',
      )}
      style={{ marginLeft: depth === 0 ? 0 : undefined }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className={cn('flex items-center gap-1', depth > 0 ? 'ml-4' : '')}>
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-slate-100"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-500" />
            )}
          </button>
        ) : (
          <div className="h-6 w-6" />
        )}
        {node.iconUrl ? (
          <div className="h-4 w-4 overflow-hidden rounded-sm bg-slate-100" />
        ) : (
          <Icon className="h-4 w-4 text-slate-500" />
        )}
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center justify-between gap-2"
      >
        {nameView}
        {node.productCount >= 1 ? (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
            {node.productCount > 99 ? '99+' : node.productCount}
          </span>
        ) : null}
      </button>

      <div className="ml-auto hidden items-center gap-1 group-hover:flex">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disableAddChild) onAddChild();
          }}
          disabled={disableAddChild}
          title={disableAddChild ? '已达最大层级' : '新增子分类'}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100',
            disableAddChild ? 'opacity-40' : '',
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="编辑"
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disableDeleteReason) onDelete();
          }}
          disabled={Boolean(disableDeleteReason)}
          title={disableDeleteReason ?? '删除'}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100',
            disableDeleteReason ? 'opacity-40' : '',
          )}
        >
          <Trash2 className="h-4 w-4 text-rose-600" />
        </button>
      </div>
    </div>
  );
}
