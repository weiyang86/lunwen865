'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleX, Square, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PromptDraft } from '@/types/prompt';
import { PromptTestOutputView } from './PromptTestOutputView';
import { useTestRun } from './hooks/useTestRun';

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: '请求过于频繁，请稍后重试',
  quota_exceeded: '当前模型配额已用完',
  model_unavailable: '模型暂不可用',
  invalid_api_key: '模型 API Key 无效或未配置',
  timeout: '请求超时',
  network: '网络异常，请检查连接',
  variable_mismatch: '变量声明与填值不匹配',
  content_filter: '内容被安全策略拦截',
  aborted: '已中止',
  unknown: '未知错误',
};

export type TestRunRecord = {
  id: string;
  startedAt: number;
  status: 'done' | 'error' | 'aborted';
  durationMs: number;
  variableValues: Record<string, unknown>;
  output: string;
  usage?: { inputTokens: number; outputTokens: number };
  finishReason?: string;
  errorCode?: string;
  errorMessage?: string;
  retryAfterMs?: number;
  modelSnapshot: { provider: string; model: string };
  contentPreview: string;
};

function formatMs(ms: number) {
  const s = ms / 1000;
  return `${s.toFixed(1)}s`;
}

export function PromptTestRunner({
  promptId,
  draftSnapshot,
  variableValues,
  overrides,
  timeoutMs,
  canRun,
  disabledReason,
  onFinished,
  onRunningChange,
}: {
  promptId: string;
  draftSnapshot: PromptDraft;
  variableValues: Record<string, unknown>;
  overrides?: { temperature?: number; maxTokens?: number };
  timeoutMs?: number;
  canRun: boolean;
  disabledReason?: string;
  onFinished: (r: TestRunRecord) => void;
  onRunningChange: (running: boolean) => void;
}) {
  const { state, run, abort, reset } = useTestRun({ promptId });
  const outputRef = useRef<HTMLDivElement | null>(null);
  const runStartedAtRef = useRef<number | null>(null);
  const runInputRef = useRef<{
    variableValues: Record<string, unknown>;
    modelSnapshot: { provider: string; model: string };
    contentPreview: string;
  } | null>(null);
  const recordedRef = useRef<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [retryLeftMs, setRetryLeftMs] = useState<number | null>(null);

  const running = state.status === 'starting' || state.status === 'streaming';

  useEffect(() => {
    onRunningChange(running);
  }, [onRunningChange, running]);

  useEffect(() => {
    if (!running) return;
    const startedAt = runStartedAtRef.current ?? Date.now();
    const t = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => window.clearInterval(t);
  }, [running, state]);

  useEffect(() => {
    if (state.status !== 'error' || !state.retryAfterMs) {
      setRetryLeftMs(null);
      return;
    }
    const end = Date.now() + state.retryAfterMs;
    setRetryLeftMs(state.retryAfterMs);
    const t = window.setInterval(() => {
      const left = end - Date.now();
      setRetryLeftMs(left > 0 ? left : 0);
      if (left <= 0) window.clearInterval(t);
    }, 1000);
    return () => window.clearInterval(t);
  }, [state]);

  const outputText = useMemo(() => {
    if (state.status === 'streaming') return state.output;
    if (state.status === 'done') return state.output;
    if (state.status === 'error') return state.partialOutput;
    return '';
  }, [state]);

  useEffect(() => {
    if (!running) return;
    if (!autoScroll) return;
    const el = outputRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [autoScroll, outputText, running]);

  const footer = useMemo(() => {
    if (state.status === 'done') {
      const inT = state.usage?.inputTokens ?? '-';
      const outT = state.usage?.outputTokens ?? '-';
      return `in ${inT} · out ${outT} · ${formatMs(state.durationMs)} · ${state.finishReason}`;
    }
    if (state.status === 'streaming') {
      const outT = state.usage?.outputTokens ?? '-';
      return `out ${outT} · ${formatMs(elapsedMs)} 进行中…`;
    }
    if (state.status === 'error') {
      return `${formatMs(state.durationMs)}`;
    }
    return undefined;
  }, [elapsedMs, state]);

  useEffect(() => {
    if (state.status !== 'done' && state.status !== 'error') return;
    const key =
      state.status === 'done'
        ? `done:${state.runId}`
        : `error:${state.code}:${state.durationMs}`;
    if (recordedRef.current === key) return;
    recordedRef.current = key;

    const startedAt = runStartedAtRef.current ?? Date.now();
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
    const status: TestRunRecord['status'] =
      state.status === 'done' ? 'done' : state.code === 'aborted' ? 'aborted' : 'error';
    const input = runInputRef.current;
    onFinished({
      id,
      startedAt,
      status,
      durationMs: state.durationMs,
      variableValues: input?.variableValues ?? {},
      output: state.status === 'done' ? state.output : state.partialOutput,
      usage: state.status === 'done' ? state.usage : undefined,
      finishReason: state.status === 'done' ? state.finishReason : undefined,
      errorCode: state.status === 'error' ? state.code : undefined,
      errorMessage: state.status === 'error' ? state.message : undefined,
      retryAfterMs: state.status === 'error' ? state.retryAfterMs : undefined,
      modelSnapshot:
        input?.modelSnapshot ?? {
          provider: draftSnapshot.modelConfig.provider,
          model: draftSnapshot.modelConfig.model,
        },
      contentPreview: input?.contentPreview ?? draftSnapshot.content.slice(0, 100),
    });
  }, [draftSnapshot, onFinished, state]);

  const errorBanner = useMemo(() => {
    if (state.status !== 'error') return undefined;
    const code = state.code || 'unknown';
    const title = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unknown;
    const countdownText =
      typeof retryLeftMs === 'number' && retryLeftMs > 0
        ? `请在 ${Math.ceil(retryLeftMs / 1000)} 秒后重试`
        : undefined;
    return { title, message: state.message, countdownText };
  }, [retryLeftMs, state]);

  const runLabel =
    state.status === 'starting'
      ? '启动中…'
      : state.status === 'streaming'
        ? '运行中…'
        : state.status === 'error'
          ? '重试'
          : '运行';

  const runDisabled = !canRun || running;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={runDisabled}
          title={!canRun && disabledReason ? disabledReason : undefined}
          onClick={() => {
            runStartedAtRef.current = Date.now();
            recordedRef.current = null;
            setElapsedMs(0);
            setAutoScroll(true);
            runInputRef.current = {
              variableValues,
              modelSnapshot: {
                provider: draftSnapshot.modelConfig.provider,
                model: draftSnapshot.modelConfig.model,
              },
              contentPreview: draftSnapshot.content.slice(0, 100),
            };
            run({
              draftSnapshot,
              variableValues,
              overrides,
              timeoutMs,
            });
          }}
        >
          {runLabel}
        </Button>
        <Button size="sm" variant="secondary" disabled={!running} onClick={abort}>
          <Square className="h-4 w-4" />
          中止
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={running || outputText.trim().length === 0}
          onClick={reset}
        >
          <Trash2 className="h-4 w-4" />
          清空
        </Button>
      </div>

      <PromptTestOutputView
        output={outputText}
        streaming={state.status === 'streaming'}
        errorBanner={errorBanner}
        footer={footer}
        scrollRef={outputRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const diff = el.scrollHeight - el.scrollTop - el.clientHeight;
          setAutoScroll(diff <= 30);
        }}
      />

      {state.status === 'error' && state.code && !ERROR_MESSAGES[state.code] ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CircleX className="h-4 w-4" />
          {state.code}
        </div>
      ) : null}
    </div>
  );
}
