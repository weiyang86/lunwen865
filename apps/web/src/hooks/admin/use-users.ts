'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchUsers } from '@/services/admin/users';
import type { AdminUser, ListUsersQuery, PaginatedResult } from '@/types/admin/user';

export function useUsers(initial: ListUsersQuery = {}) {
  const [query, setQuery] = useState<ListUsersQuery>({
    page: 1,
    pageSize: 20,
    keyword: '',
    status: 'ALL',
    ...initial,
  });
  const [data, setData] = useState<PaginatedResult<AdminUser> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: ListUsersQuery) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchUsers(q));
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
    data,
    loading,
    error,
    query,
    setQuery,
    reload: () => load(query),
  };
}
