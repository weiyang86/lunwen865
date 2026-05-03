'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { runPromptTest, type RunPromptTestController } from '@/api/prompts';
import type { PromptDraft } from '@/types/prompt';

export type TestRunState =
  | { status: 'idle' }
  | { status: 'starting'; startedAt: number }
  | {
      status: 'streaming';
      runId: string;
      output: string;
      startedAt: number;
      usage?: { inputTokens: number; outputTokens: number };
    }
  | {
      status: 'done';
      runId: string;
      output: string;
      durationMs: number;
      usage?: { inputTokens: number; outputTokens: number };
      finishReason: string;
    }
  | {
      status: 'error';
      code: string;
      message: string;
      partialOutput: string;
      durationMs: number;
      retryAfterMs?: number;
    };

export function useTestRun(opts: { promptId: string }): {
  state: TestRunState;
  run: (input: {
    draftSnapshot: PromptDraft;
    variableValues: Record<string, unknown>;
    overrides?: { temperature?: number; maxTokens?: number };
    timeoutMs?: number;
  }) => void;
  abort: () => void;
  reset: () => void;
} {
  const [state, setState] = useState<TestRunState>({ status: 'idle' });
  const controllerRef = useRef<RunPromptTestController | null>(null);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abort();
    setState({ status: 'idle' });
  }, [abort]);

  const run = useCallback(
    (input: {
      draftSnapshot: PromptDraft;
      variableValues: Record<string, unknown>;
      overrides?: { temperature?: number; maxTokens?: number };
      timeoutMs?: number;
    }) => {
      if (state.status === 'starting' || state.status === 'streaming') return;
      const startedAt = Date.now();
      setState({ status: 'starting', startedAt });

      const mergedModelConfig = {
        ...input.draftSnapshot.modelConfig,
        ...(input.overrides?.temperature !== undefined
          ? { temperature: input.overrides.temperature }
          : {}),
        ...(input.overrides?.maxTokens !== undefined ? { maxTokens: input.overrides.maxTokens } : {}),
      };

      const typeMap = new Map(input.draftSnapshot.variables.map((v) => [v.name, v.type]));
      const normalizedValues: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input.variableValues)) {
        const t = typeMap.get(k);
        if (t === 'textarea' && typeof v === 'string') {
          const raw = v.trim();
          if (raw.length === 0) normalizedValues[k] = '';
          else {
            try {
              normalizedValues[k] = JSON.parse(raw);
            } catch {
              normalizedValues[k] = v;
            }
          }
        } else {
          normalizedValues[k] = v;
        }
      }

      controllerRef.current = runPromptTest(
        opts.promptId,
        {
          content: input.draftSnapshot.content,
          variables: input.draftSnapshot.variables,
          variableValues: normalizedValues,
          modelConfig: mergedModelConfig,
          metadata: input.draftSnapshot.metadata,
          stream: true,
          timeoutMs: input.timeoutMs,
        },
        {
          onStart: (e) => {
            setState({
              status: 'streaming',
              runId: e.runId,
              output: '',
              startedAt,
            });
          },
          onChunk: (e) => {
            setState((prev) => {
              if (prev.status !== 'streaming') return prev;
              return { ...prev, output: prev.output + (e.delta ?? '') };
            });
          },
          onUsage: (e) => {
            setState((prev) => {
              if (prev.status !== 'streaming') return prev;
              return {
                ...prev,
                usage: { inputTokens: e.inputTokens, outputTokens: e.outputTokens },
              };
            });
          },
          onDone: (e) => {
            setState((prev) => {
              const out = prev.status === 'streaming' ? prev.output : '';
              return {
                status: 'done',
                runId: prev.status === 'streaming' ? prev.runId : 'unknown',
                output: out,
                durationMs: Date.now() - startedAt,
                usage: prev.status === 'streaming' ? prev.usage : undefined,
                finishReason: e.finishReason ?? 'stop',
              };
            });
            controllerRef.current = null;
          },
          onError: (e) => {
            setState((prev) => {
              const partial = prev.status === 'streaming' ? prev.output : '';
              return {
                status: 'error',
                code: e.code ?? 'unknown',
                message: e.message ?? '未知错误',
                partialOutput: partial,
                durationMs: Date.now() - startedAt,
                retryAfterMs: e.retryAfterMs,
              };
            });
            controllerRef.current = null;
          },
        },
      );
    },
    [opts.promptId, state.status],
  );

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  return { state, run, abort, reset };
}
