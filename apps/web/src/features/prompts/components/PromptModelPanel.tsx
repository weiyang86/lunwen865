'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ModelConfig } from '@/types/prompt';

interface Props {
  value: ModelConfig;
  onChange: (next: ModelConfig) => void;
}

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
  custom: [],
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  custom: '自定义',
};

function SectionTitle({ text }: { text: string }) {
  return (
    <div className="flex items-center text-xs uppercase tracking-wide text-slate-400">
      <div className="flex-1 border-t border-slate-200" />
      <span className="px-3">{text}</span>
      <div className="flex-1 border-t border-slate-200" />
    </div>
  );
}

function clampNum(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function PromptModelPanel({ value, onChange }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const models = PROVIDER_MODELS[value.provider] ?? [];
  const isCustom = value.provider === 'custom';

  const providerOptions = useMemo(() => Object.keys(PROVIDER_LABELS), []);

  function update(patch: Partial<ModelConfig>) {
    onChange({ ...value, ...patch });
  }

  function updateOptionalNumber(
    key: 'topP' | 'frequencyPenalty' | 'presencePenalty',
    raw: string,
    min: number,
    max: number,
  ) {
    const trimmed = raw.trim();
    if (trimmed === '') {
      const next: any = { ...value };
      delete next[key];
      onChange(next);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return;
    update({ [key]: clampNum(n, min, max) } as any);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="space-y-4">
        <div className="text-sm font-semibold text-slate-900">模型配置</div>

        <div className="space-y-3">
          <div className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-4 text-sm text-slate-600">提供商</div>
            <div className="col-span-8">
              <select
                value={value.provider}
                onChange={(e) => {
                  const nextProvider = e.target.value;
                  const nextModels = PROVIDER_MODELS[nextProvider] ?? [];
                  const nextModel = nextProvider === 'custom' ? '' : nextModels[0] ?? '';
                  onChange({ ...value, provider: nextProvider, model: nextModel });
                }}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary"
              >
                {providerOptions.map((k) => (
                  <option key={k} value={k}>
                    {PROVIDER_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-4 text-sm text-slate-600">模型</div>
            <div className="col-span-8">
              {isCustom ? (
                <Input
                  value={value.model}
                  onChange={(e) => update({ model: e.target.value.slice(0, 60) })}
                  placeholder="输入模型名称"
                  className="h-9"
                />
              ) : (
                <select
                  value={value.model}
                  onChange={(e) => update({ model: e.target.value })}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary"
                >
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <SectionTitle text="基本参数" />

        <div className="space-y-3">
          <div className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-4 text-sm text-slate-600">Temperature</div>
            <div className="col-span-8">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={value.temperature}
                  onChange={(e) => update({ temperature: Number(e.target.value) })}
                  className="w-full"
                />
                <div className="w-12 text-right font-mono text-sm tabular-nums text-slate-900">
                  {value.temperature.toFixed(1)}
                </div>
              </div>
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>更确定</span>
                <span>更随机</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-4 text-sm text-slate-600">Max Tokens</div>
            <div className="col-span-8">
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={32768}
                  step={1}
                  value={Number.isFinite(value.maxTokens) ? value.maxTokens : 2048}
                  onChange={(e) => update({ maxTokens: Number(e.target.value) })}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const n = raw === '' ? NaN : Number(raw);
                    if (!Number.isFinite(n)) update({ maxTokens: 2048 });
                    else update({ maxTokens: clampNum(Math.trunc(n), 1, 32768) });
                  }}
                  className="h-9"
                />
                <div className="text-xs text-slate-400">范围 1-32768</div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          {advancedOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          高级参数
        </button>

        {advancedOpen ? (
          <div className="space-y-3">
            <div className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-4 text-sm text-slate-600">Top P</div>
              <div className="col-span-8">
                <Input
                  value={value.topP ?? ''}
                  onChange={(e) => updateOptionalNumber('topP', e.target.value, 0, 1)}
                  onBlur={(e) => updateOptionalNumber('topP', e.target.value, 0, 1)}
                  placeholder="默认 1.0"
                  className={cn('h-9 font-mono')}
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-4 text-sm text-slate-600">Frequency Penalty</div>
              <div className="col-span-8">
                <Input
                  value={value.frequencyPenalty ?? ''}
                  onChange={(e) =>
                    updateOptionalNumber('frequencyPenalty', e.target.value, -2, 2)
                  }
                  onBlur={(e) =>
                    updateOptionalNumber('frequencyPenalty', e.target.value, -2, 2)
                  }
                  placeholder="默认 0"
                  className="h-9 font-mono"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-4 text-sm text-slate-600">Presence Penalty</div>
              <div className="col-span-8">
                <Input
                  value={value.presencePenalty ?? ''}
                  onChange={(e) =>
                    updateOptionalNumber('presencePenalty', e.target.value, -2, 2)
                  }
                  onBlur={(e) =>
                    updateOptionalNumber('presencePenalty', e.target.value, -2, 2)
                  }
                  placeholder="默认 0"
                  className="h-9 font-mono"
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

