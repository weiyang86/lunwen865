'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { Category, CategoryReorderPayload, CategoryUpsertPayload } from '@/types/admin/category';
import { createCategory, fetchCategoryTree, removeCategory, reorderCategories, updateCategory } from '@/services/admin/categories';

function flattenTree(tree: Category[]) {
  const map = new Map<string, Category>();
  const parentMap = new Map<string, string | null>();
  const dfs = (nodes: Category[], parentId: string | null) => {
    for (const n of nodes) {
      map.set(n.id, n);
      parentMap.set(n.id, parentId);
      if (n.children?.length) dfs(n.children, n.id);
    }
  };
  dfs(tree, null);
  return { map, parentMap };
}

function getDepth(parentMap: Map<string, string | null>, id: string) {
  let depth = 1;
  let cur: string | null | undefined = id;
  while (cur) {
    cur = parentMap.get(cur);
    if (cur) depth += 1;
    if (depth > 3) break;
  }
  return depth;
}

function cloneTree(tree: Category[]): Category[] {
  return tree.map((n) => ({
    ...n,
    children: n.children ? cloneTree(n.children) : [],
  }));
}

function findAndUpdateChildren(
  nodes: Category[],
  parentId: string | null,
  updater: (children: Category[]) => Category[],
): Category[] {
  if (parentId == null) {
    return updater(nodes);
  }
  return nodes.map((n) => {
    if (n.id === parentId) {
      const children = n.children ? [...n.children] : [];
      return { ...n, children: updater(children) };
    }
    if (n.children?.length) {
      return { ...n, children: findAndUpdateChildren(n.children, parentId, updater) };
    }
    return n;
  });
}

export function useCategoryTree() {
  const [tree, setTree] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { map: flatMap, parentMap } = useMemo(() => flattenTree(tree), [tree]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCategoryTree();
      setTree(data);
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e ? String((e as any).message) : null) ||
        '加载分类失败';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectCategory = useCallback((id: string | undefined) => {
    setSelectedId(id);
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const create = useCallback(
    async (payload: CategoryUpsertPayload) => {
      await createCategory(payload);
      toast.success('分类已创建');
      await refetch();
    },
    [refetch],
  );

  const update = useCallback(
    async (id: string, payload: CategoryUpsertPayload) => {
      await updateCategory(id, payload);
      toast.success('已保存');
      await refetch();
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      await removeCategory(id);
      toast.success('分类已删除');
      if (selectedId === id) setSelectedId(undefined);
      await refetch();
    },
    [refetch, selectedId],
  );

  const reorder = useCallback(
    async (parentId: string | null, orderedIds: string[]) => {
      const prev = tree;
      setTree((cur) => {
        const next = cloneTree(cur);
        return findAndUpdateChildren(next, parentId, (children) => {
          const byId = new Map(children.map((c) => [c.id, c]));
          return orderedIds.map((id, idx) => ({ ...byId.get(id)!, sort: idx }));
        });
      });
      try {
        await reorderCategories({ parentId, orderedIds } satisfies CategoryReorderPayload);
        toast.success('排序已更新');
      } catch (e: unknown) {
        setTree(prev);
        const msg =
          (e && typeof e === 'object' && 'message' in e ? String((e as any).message) : null) ||
          '排序失败';
        toast.error(msg);
      }
    },
    [tree],
  );

  const getNodeDepth = useCallback(
    (id: string) => getDepth(parentMap, id),
    [parentMap],
  );

  return {
    tree,
    flatMap,
    loading,
    selectedId,
    selectCategory,
    expandedIds,
    toggleExpand,
    refetch,
    create,
    update,
    remove,
    reorder,
    getNodeDepth,
  };
}
