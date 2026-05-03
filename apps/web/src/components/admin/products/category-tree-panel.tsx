'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Category } from '@/types/admin/category';
import { CategoryFormDialog } from './category-form-dialog';
import { CategoryTree } from './category-tree';
import { ConfirmCategoryDeleteDialog } from './confirm-category-delete-dialog';

type FormState =
  | { open: false }
  | { open: true; mode: 'create' | 'edit'; parent: Category | null; current: Category | null };

function filterTree(tree: Category[], keyword: string) {
  const k = keyword.trim().toLowerCase();
  if (!k) return { filtered: tree, autoExpand: new Set<string>() };
  const autoExpand = new Set<string>();

  const dfs = (nodes: Category[]): Category[] => {
    const out: Category[] = [];
    for (const n of nodes) {
      const children = n.children ? dfs(n.children) : [];
      const hit = n.name.toLowerCase().includes(k);
      if (hit || children.length > 0) {
        if (children.length > 0) autoExpand.add(n.id);
        out.push({ ...n, children });
      }
    }
    return out;
  };
  return { filtered: dfs(tree), autoExpand };
}

interface Props {
  tree: Category[];
  loading: boolean;
  selectedId: string | undefined;
  expandedIds: Set<string>;
  selectCategory: (id: string | undefined) => void;
  toggleExpand: (id: string) => void;
  getNodeDepth: (id: string) => number;
  onCreate: (payload: { parentId: string | null; name: string; iconUrl?: string }) => Promise<void> | void;
  onUpdate: (id: string, payload: { parentId: string | null; name: string; iconUrl?: string }) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
  onReorder: (parentId: string | null, orderedIds: string[]) => Promise<void> | void;
}

export function CategoryTreePanel({
  tree,
  loading,
  selectedId,
  expandedIds,
  selectCategory,
  toggleExpand,
  getNodeDepth,
  onCreate,
  onUpdate,
  onRemove,
  onReorder,
}: Props) {
  const [keyword, setKeyword] = useState('');
  const [form, setForm] = useState<FormState>({ open: false });
  const [formLoading, setFormLoading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteNode, setDeleteNode] = useState<Category | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { filtered, autoExpand } = useMemo(() => filterTree(tree, keyword), [tree, keyword]);

  useEffect(() => {
    if (!keyword.trim()) return;
    for (const id of autoExpand) {
      if (!expandedIds.has(id)) toggleExpand(id);
    }
  }, [autoExpand, expandedIds, keyword, toggleExpand]);

  const flatChildrenCount = useMemo(() => {
    const m = new Map<string, number>();
    const dfs = (nodes: Category[]) => {
      for (const n of nodes) {
        m.set(n.id, n.children?.length ?? 0);
        if (n.children?.length) dfs(n.children);
      }
    };
    dfs(tree);
    return m;
  }, [tree]);

  const idMap = useMemo(() => {
    const m = new Map<string, Category>();
    const dfs = (nodes: Category[]) => {
      for (const n of nodes) {
        m.set(n.id, n);
        if (n.children?.length) dfs(n.children);
      }
    };
    dfs(tree);
    return m;
  }, [tree]);

  function deleteReason(n: Category) {
    if ((flatChildrenCount.get(n.id) ?? 0) > 0) return '请先删除/移除子分类';
    if (n.productCount > 0) return `分类下仍有 ${n.productCount} 个商品`;
    return null;
  }

  async function submitCategory(payload: { parentId: string | null; name: string; iconUrl?: string }) {
    setFormLoading(true);
    try {
      if (form.open && form.mode === 'edit' && form.current) {
        await onUpdate(form.current.id, payload);
      } else {
        await onCreate(payload);
      }
      setForm({ open: false });
    } finally {
      setFormLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteNode) return;
    setDeleteLoading(true);
    try {
      await onRemove(deleteNode.id);
      setDeleteOpen(false);
      setDeleteNode(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">商品分类</div>
        <Button
          size="sm"
          onClick={() => setForm({ open: true, mode: 'create', parent: null, current: null })}
        >
          <Plus className="h-4 w-4" />
          新增
        </Button>
      </div>

      <div className="px-4 pb-3">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索分类"
          className="h-9"
        />
      </div>

      <div className="flex-1 overflow-auto px-3 pb-3">
        {loading ? (
          <div className="space-y-2 px-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        ) : (
          <CategoryTree
            tree={filtered}
            selectedId={selectedId}
            expandedIds={expandedIds}
            highlight={keyword}
            onToggleExpand={toggleExpand}
            onSelect={selectCategory}
            getNodeDepth={getNodeDepth}
            onAdd={(parent) =>
              setForm({ open: true, mode: 'create', parent, current: null })
            }
            onEdit={(node) =>
              setForm({
                open: true,
                mode: 'edit',
                parent: node.parentId ? idMap.get(node.parentId) ?? null : null,
                current: node,
              })
            }
            onDelete={(node) => {
              setDeleteNode(node);
              setDeleteOpen(true);
            }}
            onReorder={onReorder}
            disableDeleteReason={deleteReason}
          />
        )}
      </div>

      <div className="border-t px-4 py-2 text-xs text-slate-500">
        拖拽节点可调整同级顺序
      </div>

      <CategoryFormDialog
        open={form.open}
        mode={form.open ? form.mode : 'create'}
        parent={form.open ? form.parent : null}
        current={form.open ? form.current : null}
        loading={formLoading}
        onSubmit={submitCategory}
        onClose={() => setForm({ open: false })}
      />

      <ConfirmCategoryDeleteDialog
        open={deleteOpen}
        category={deleteNode}
        disabledReason={deleteNode ? deleteReason(deleteNode) : null}
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
