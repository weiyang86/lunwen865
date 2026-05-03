'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchDashboardStats } from '@/services/admin/dashboard';
import type { DashboardStats } from '@/types/admin/dashboard';

export function useDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDashboardStats());
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
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

