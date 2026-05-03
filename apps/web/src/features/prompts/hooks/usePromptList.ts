'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { promptApi } from '@/api/prompts';
import type { PromptListQuery, PromptTemplate } from '@/types/prompt';

type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

const INITIAL_QUERY: PromptListQuery = { page: 1, pageSize: 20 };

export function usePromptList(): {
  query: PromptListQuery;
  setQuery: (patch: Partial<PromptListQuery>) => void;
  data: Paged<PromptTemplate> | undefined;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
  allTags: string[];
} {
  const [query, setQueryState] = useState<PromptListQuery>(INITIAL_QUERY);
  const [data, setData] = useState<Paged<PromptTemplate> | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

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
      const next: PromptListQuery = { ...prev, ...patch };

      const touchNonPage =
        ('keyword' in patch && patch.keyword !== prev.keyword) ||
        ('status' in patch && patch.status !== prev.status) ||
        ('tags' in patch && patch.tags !== prev.tags) ||
        ('pageSize' in patch && patch.pageSize !== prev.pageSize);

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
    promptApi
      .listAllTags()
      .then((r) => {
        if (!cancelled) setAllTags(r);
      })
      .catch(() => {
        if (!cancelled) setAllTags([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);
    promptApi
      .list(effectiveQuery, controller.signal)
      .then((r) => setData(r))
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

  return { query, setQuery, data, loading, error, refresh, allTags };
}

export { INITIAL_QUERY };

