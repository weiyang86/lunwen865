'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchStores } from '@/services/admin/stores';
import type { Store, StoreListQuery, StoreListResp } from '@/types/admin/store';

export function useStoreList(initial?: Partial<StoreListQuery>) {
  const [query, setQuery] = useState<StoreListQuery>({
    page: 1,
    pageSize: 20,
    status: 'ALL',
    keyword: '',
    ...initial,
  });
  const [data, setData] = useState<StoreListResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: StoreListQuery) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchStores(q));
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '加载失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(query);
  }, [query, load]);

  return {
    query,
    setQuery,
    loading,
    error,
    data,
    list: data?.list ?? ([] as Store[]),
    total: data?.total ?? 0,
    refetch: () => load(query),
  };
}

