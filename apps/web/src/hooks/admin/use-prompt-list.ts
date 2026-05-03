'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PromptListQuery, PromptListResp, PromptSceneMeta } from '@/types/admin/prompt';
import { fetchPromptScenes, fetchPrompts } from '@/services/admin/prompts';

export function usePromptList() {
  const [query, setQueryState] = useState<PromptListQuery>({
    page: 1,
    pageSize: 20,
    status: 'ALL',
    keyword: '',
    scenes: [],
  });
  const [data, setData] = useState<PromptListResp | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [allScenes, setAllScenes] = useState<PromptSceneMeta[]>([]);

  const keywordRef = useRef(query.keyword ?? '');
  const [debouncedKeyword, setDebouncedKeyword] = useState(query.keyword ?? '');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keywordRef.current), 300);
    return () => clearTimeout(t);
  }, [query.keyword]);

  const effectiveQuery = useMemo(() => {
    return { ...query, keyword: debouncedKeyword };
  }, [debouncedKeyword, query]);

  const setQuery = useCallback((patch: Partial<PromptListQuery>) => {
    setQueryState((prev) => {
      const next = { ...prev, ...patch };
      const touchNonPage =
        ('keyword' in patch && patch.keyword !== prev.keyword) ||
        ('status' in patch && patch.status !== prev.status) ||
        ('scenes' in patch && patch.scenes !== prev.scenes);
      if (touchNonPage) next.page = 1;
      if ('keyword' in patch) keywordRef.current = patch.keyword ?? '';
      return next;
    });
  }, []);

  const refresh = useCallback(() => {
    setQueryState((q) => ({ ...q }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPromptScenes()
      .then((r) => {
        if (!cancelled) setAllScenes(r);
      })
      .catch(() => {
        if (!cancelled) setAllScenes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchPrompts(effectiveQuery, controller.signal)
      .then((r) => {
        setData(r);
      })
      .catch((e: any) => {
        if (controller.signal.aborted) return;
        const msg = e?.message || '加载失败';
        toast.error(msg);
        setError(e instanceof Error ? e : new Error(msg));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [effectiveQuery]);

  return {
    query,
    setQuery,
    data,
    loading,
    error,
    refresh,
    allScenes,
  };
}

