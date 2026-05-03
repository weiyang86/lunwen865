'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { ProductListItem, ProductListQuery, ProductListResp, ProductStatus } from '@/types/admin/product';
import { batchRemoveProducts, batchUpdateProductStatus, fetchProducts, removeProduct, updateProductStatus } from '@/services/admin/products';

export function useProductList(initial?: Partial<ProductListQuery>) {
  const [query, setQuery] = useState<ProductListQuery>({
    page: 1,
    pageSize: 20,
    status: 'ALL',
    keyword: '',
    includeSubCategory: true,
    ...initial,
  });
  const [data, setData] = useState<ProductListResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedCount = selectedIds.size;

  const list = useMemo(() => data?.list ?? ([] as ProductListItem[]), [data?.list]);
  const total = data?.total ?? 0;

  const load = useCallback(async (q: ProductListQuery) => {
    setLoading(true);
    try {
      setData(await fetchProducts(q));
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e ? String((e as any).message) : null) ||
        '加载商品失败';
      toast.error(msg);
      setData({ list: [], total: 0, page: q.page, pageSize: q.pageSize });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(query);
  }, [query, load]);

  const pageIds = useMemo(() => list.map((p) => p.id), [list]);
  const allSelectedInPage = useMemo(() => pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id)), [pageIds, selectedIds]);
  const someSelectedInPage = useMemo(() => pageIds.some((id) => selectedIds.has(id)), [pageIds, selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllInPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const ids = pageIds;
      const all = ids.length > 0 && ids.every((id) => next.has(id));
      if (all) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }, [pageIds]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const refresh = useCallback(() => load(query), [load, query]);

  const updateStatus = useCallback(async (id: string, status: 'ON_SALE' | 'OFF_SHELF') => {
    await updateProductStatus(id, status);
    toast.success(status === 'ON_SALE' ? '已上架' : '已下架');
    await refresh();
  }, [refresh]);

  const removeOne = useCallback(async (id: string) => {
    await removeProduct(id);
    toast.success('已删除');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await refresh();
  }, [refresh]);

  const batchStatus = useCallback(async (ids: string[], status: 'ON_SALE' | 'OFF_SHELF') => {
    const r = await batchUpdateProductStatus(ids, status);
    toast.success(`已更新 ${r.updated} 项`);
    await refresh();
  }, [refresh]);

  const batchRemove = useCallback(async (ids: string[]) => {
    const r = await batchRemoveProducts(ids);
    toast.success(`已删除 ${r.removed} 项`);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    await refresh();
  }, [refresh]);

  const setCategory = useCallback((categoryId: string | undefined) => {
    setSelectedIds(new Set());
    setQuery((q) => ({
      ...q,
      categoryId,
      includeSubCategory: categoryId ? q.includeSubCategory ?? true : true,
      page: 1,
    }));
  }, []);

  const setKeyword = useCallback((keyword: string) => {
    setQuery((q) => ({ ...q, keyword, page: 1 }));
  }, []);

  const setStatus = useCallback((status: ProductStatus | 'ALL') => {
    setQuery((q) => ({ ...q, status, page: 1 }));
  }, []);

  const setIncludeSubCategory = useCallback((v: boolean) => {
    setQuery((q) => ({ ...q, includeSubCategory: v, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => setQuery((q) => ({ ...q, page })), []);
  const setPageSize = useCallback((pageSize: number) => setQuery((q) => ({ ...q, pageSize, page: 1 })), []);

  return {
    query,
    setQuery,
    list,
    total,
    page: data?.page ?? query.page,
    pageSize: data?.pageSize ?? query.pageSize,
    loading,
    refresh,
    selectedIds,
    selectedCount,
    allSelectedInPage,
    someSelectedInPage,
    toggleSelect,
    toggleSelectAllInPage,
    clearSelection,
    updateStatus,
    removeOne,
    batchStatus,
    batchRemove,
    setCategory,
    setKeyword,
    setStatus,
    setIncludeSubCategory,
    setPage,
    setPageSize,
  };
}
