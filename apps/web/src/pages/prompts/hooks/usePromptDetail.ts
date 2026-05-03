'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { promptApi } from '@/api/prompts';
import type { PromptTemplateDetail } from '@/types/prompt';

export function usePromptDetail(id: string): {
  data: PromptTemplateDetail | undefined;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
} {
  const [data, setData] = useState<PromptTemplateDetail | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();

    setLoading(true);
    setError(null);
    promptApi
      .detail(id, controller.signal)
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
  }, [id, nonce]);

  return { data, loading, error, refresh };
}

