'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { promptApi } from '@/api/prompts';
import {
  DEFAULT_MODEL_CONFIG,
  type ModelConfig,
  type PromptMetadata,
  type PromptDraft,
  type PromptTemplateDetail,
  type PromptVariable,
  type PromptVersion,
} from '@/types/prompt';
import { isDraftDirty } from '../utils/promptDirty';

type ModelMeta = { id: string; label: string; provider: string };

type Snapshot = {
  content: string;
  variables: PromptVariable[];
  modelConfig: ModelConfig;
  metadata: PromptMetadata;
};

export function usePromptEditor(templateId: string): {
  detail: PromptTemplateDetail | undefined;
  loading: boolean;
  error: Error | null;
  refresh: () => void;

  content: string;
  setContent: (v: string) => void;
  variables: PromptVariable[];
  setVariables: (vs: PromptVariable[]) => void;
  updateVariable: (idx: number, patch: Partial<PromptVariable>) => void;
  modelConfig: ModelConfig;
  setModelConfig: (next: ModelConfig) => void;
  metadata: PromptMetadata;
  updateMetadata: (patch: Partial<PromptMetadata>) => void;

  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: Date | null;
  saveNow: () => Promise<void>;
  hasDraft: boolean;
  isDirty: boolean;
  baseVersion: PromptVersion | null;
  discardDraft: () => Promise<void>;
  applyNewVersion: (v: PromptVersion) => void;

  models: ModelMeta[];
  modelsLoading: boolean;
} {
  const [detail, setDetail] = useState<PromptTemplateDetail | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const [content, setContent] = useState('');
  const [variables, setVariables] = useState<PromptVariable[]>([]);
  const [modelConfig, setModelConfig] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG);
  const [metadata, setMetadata] = useState<PromptMetadata>({
    title: '',
    description: '',
    tags: [],
  });
  const [baseVersion, setBaseVersion] = useState<PromptVersion | null>(null);

  const updateVariable = useCallback((idx: number, patch: Partial<PromptVariable>) => {
    setVariables((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }, []);

  const updateMetadata = useCallback((patch: Partial<PromptMetadata>) => {
    setMetadata((prev) => ({ ...prev, ...patch }));
    setDetail((d) => {
      if (!d) return d;
      const next = { ...d };
      if (patch.title !== undefined) next.name = patch.title;
      if (patch.description !== undefined) next.description = patch.description;
      if (patch.tags !== undefined) next.tags = patch.tags;
      return next;
    });
  }, []);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [models, setModels] = useState<ModelMeta[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const modelsErrorToastRef = useRef(false);

  const initializedRef = useRef(false);
  const suppressAutoSaveRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  const latestRef = useRef<Snapshot>({
    content,
    variables,
    modelConfig,
    metadata,
  });

  useEffect(() => {
    latestRef.current = {
      content,
      variables,
      modelConfig,
      metadata,
    };
  }, [content, metadata, modelConfig, variables]);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    promptApi
      .listModels()
      .then((r) => {
        if (cancelled) return;
        setModels(r);
      })
      .catch(() => {
        if (cancelled) return;
        setModels([]);
        if (!modelsErrorToastRef.current) {
          modelsErrorToastRef.current = true;
          toast.error('模型列表加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
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
      .detail(templateId, controller.signal)
      .then((r) => {
        setDetail(r);
        setBaseVersion(r.currentVersion ?? null);
        initializedRef.current = false;
        setSaveStatus('idle');
        setLastSavedAt(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        const msg =
          e && typeof e === 'object' && 'message' in e ? String((e as any).message) : '加载失败';
        toast.error(msg);
        setError(e instanceof Error ? e : new Error(msg));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [templateId, nonce]);

  useEffect(() => {
    if (!detail) return;
    if (initializedRef.current) return;

    suppressAutoSaveRef.current = true;
    const base = detail.draft ?? detail.currentVersion;

    setMetadata(
      base?.metadata ?? {
        title: detail.name,
        description: detail.description,
        tags: detail.tags,
      },
    );

    if (base) {
      setContent(base.content ?? '');
      setVariables(Array.isArray(base.variables) ? base.variables : []);
      setModelConfig(base.modelConfig ?? DEFAULT_MODEL_CONFIG);
    } else {
      setContent('');
      setVariables([]);
      setModelConfig(DEFAULT_MODEL_CONFIG);
    }

    initializedRef.current = true;
  }, [detail]);

  const hasDraft = detail?.draft != null;

  const isDirty = useMemo(() => {
    return isDraftDirty(
      { content, variables, modelConfig, metadata },
      baseVersion,
    );
  }, [baseVersion, content, metadata, modelConfig, variables]);

  const triggerSave = useCallback(async (): Promise<void> => {
    const doSave = async (): Promise<void> => {
      if (!initializedRef.current) return;
      if (inFlightRef.current) {
        pendingRef.current = true;
        await (savePromiseRef.current ?? Promise.resolve());
        return;
      }

      inFlightRef.current = true;
      setSaveStatus('saving');
      const snap = latestRef.current;

      const p = (async () => {
        try {
          const saved = await promptApi.saveDraft(templateId, {
            content: snap.content,
            variables: snap.variables,
            modelConfig: snap.modelConfig,
            metadata: snap.metadata,
          });
          setSaveStatus('saved');
          setLastSavedAt(new Date());
          setDetail((d) => {
            if (!d) return d;
            const nextDraft: PromptDraft = {
              templateId,
              content: saved.content,
              variables: saved.variables,
              modelConfig: saved.modelConfig,
              metadata: saved.metadata,
              updatedAt: saved.updatedAt,
            };
            return {
              ...d,
              name: saved.metadata.title,
              description: saved.metadata.description,
              tags: saved.metadata.tags,
              draft: nextDraft,
            };
          });
          setMetadata(saved.metadata);
        } catch {
          setSaveStatus('error');
          toast.error('草稿保存失败，将在下次变更时重试');
        } finally {
          inFlightRef.current = false;
          if (pendingRef.current) {
            pendingRef.current = false;
            await doSave();
          }
        }
      })();

      savePromiseRef.current = p;
      await p;
    };

    await doSave();
  }, [templateId]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await triggerSave();
  }, [triggerSave]);

  useEffect(() => {
    if (!initializedRef.current) return;
    if (suppressAutoSaveRef.current) {
      suppressAutoSaveRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void triggerSave();
    }, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, metadata, modelConfig, triggerSave, variables]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        if (initializedRef.current) {
          const snap = latestRef.current;
          void promptApi
            .saveDraft(templateId, {
              content: snap.content,
              variables: snap.variables,
              modelConfig: snap.modelConfig,
              metadata: snap.metadata,
            })
            .catch(() => null);
        }
      }
    };
  }, [templateId]);

  const applyNewVersion = useCallback((v: PromptVersion) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    suppressAutoSaveRef.current = true;
    pendingRef.current = false;
    setBaseVersion(v);
    setDetail((d) => {
      if (!d) return d;
      return {
        ...d,
        currentVersion: v,
        currentVersionNo: v.versionNo,
        name: v.metadata.title,
        description: v.metadata.description,
        tags: v.metadata.tags,
        draft: null,
      };
    });
    setContent(v.content);
    setVariables(v.variables);
    setModelConfig(v.modelConfig);
    setMetadata(v.metadata);
    setSaveStatus('idle');
    setLastSavedAt(null);
  }, []);

  const discardDraft = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    suppressAutoSaveRef.current = true;
    pendingRef.current = false;

    const base = baseVersion;
    const baseMeta: PromptMetadata =
      base?.metadata ??
      (detail
        ? { title: detail.name, description: detail.description, tags: detail.tags }
        : { title: '', description: '', tags: [] });

    setContent(base?.content ?? '');
    setVariables(base?.variables ?? []);
    setModelConfig(base?.modelConfig ?? DEFAULT_MODEL_CONFIG);
    setMetadata(baseMeta);
    setDetail((d) => {
      if (!d) return d;
      return { ...d, draft: null, name: baseMeta.title, description: baseMeta.description, tags: baseMeta.tags };
    });
    setSaveStatus('idle');
    setLastSavedAt(null);

    try {
      await promptApi.discardDraft(templateId);
    } catch (e: any) {
      toast.error(e?.message || '丢弃草稿失败（已在本地清空）');
    }
  }, [baseVersion, detail, templateId]);

  return {
    detail,
    loading,
    error,
    refresh,

    content,
    setContent,
    variables,
    setVariables,
    updateVariable,
    modelConfig,
    setModelConfig,
    metadata,
    updateMetadata,

    saveStatus,
    lastSavedAt,
    saveNow,
    hasDraft,
    isDirty,
    baseVersion,
    discardDraft,
    applyNewVersion,

    models,
    modelsLoading,
  };
}
