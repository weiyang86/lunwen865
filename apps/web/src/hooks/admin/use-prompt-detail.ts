'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { PromptTemplateDetail } from '@/types/admin/prompt';
import { fetchPromptDetail } from '@/services/admin/prompts';

export function usePromptDetail(id: string | null) {
  const [data, setData] = useState<PromptTemplateDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchPromptDetail(id, signal));
    } catch (e: any) {
      if (signal?.aborted) return;
      const msg = e?.message || '加载失败';
      toast.error(msg);
      setError(e instanceof Error ? e : new Error(msg));
      setData(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { data, loading, error, refresh: () => load() };
}
