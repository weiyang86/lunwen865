'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { PromptVariable } from '@/types/prompt';

type Kind = 'string' | 'number' | 'boolean' | 'enum' | 'json';

function kindOf(v: PromptVariable): Kind {
  if (v.type === 'number') return 'number';
  if (v.type === 'select') {
    const opts = v.options ?? [];
    const set = new Set(opts);
    if (set.size === 2 && set.has('true') && set.has('false')) return 'boolean';
    return 'enum';
  }
  if (v.type === 'textarea') return 'json';
  return 'string';
}

function defaultValueFor(v: PromptVariable, kind: Kind): unknown {
  const raw = v.defaultValue ?? '';
  if (kind === 'number') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
    return v.required ? 0 : null;
  }
  if (kind === 'boolean') return raw === 'true';
  if (kind === 'enum') return raw || (v.options?.[0] ?? '');
  if (kind === 'json') return raw || '{}';
  return raw;
}

function isEmptyValue(kind: Kind, v: unknown) {
  if (v === null || v === undefined) return true;
  if (kind === 'string' || kind === 'enum' || kind === 'json') return String(v).trim() === '';
  return false;
}

export function PromptTestVariablesForm({
  variables,
  disabled,
  values,
  onChangeValues,
  onValidityChange,
  overrides,
  onChangeOverrides,
}: {
  variables: PromptVariable[];
  disabled: boolean;
  values: Record<string, unknown>;
  onChangeValues: (next: Record<string, unknown>) => void;
  onValidityChange: (ok: boolean, reason?: string) => void;
  overrides: { temperature?: number; maxTokens?: number };
  onChangeOverrides: (next: { temperature?: number; maxTokens?: number }) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const kinds = useMemo(() => {
    const map = new Map<string, Kind>();
    for (const v of variables) map.set(v.name, kindOf(v));
    return map;
  }, [variables]);

  useEffect(() => {
    const next: Record<string, unknown> = { ...values };

    const prevKinds = new Map<string, Kind>();
    for (const k of Object.keys(values)) {
      const cur = kinds.get(k);
      if (cur) prevKinds.set(k, cur);
    }

    const curNames = new Set(variables.map((v) => v.name));
    for (const key of Object.keys(next)) {
      if (!curNames.has(key)) delete next[key];
    }

    for (const v of variables) {
      const k = kindOf(v);
      const existing = next[v.name];
      const prevKind = prevKinds.get(v.name);
      if (existing === undefined) next[v.name] = defaultValueFor(v, k);
      else if (prevKind && prevKind !== k) next[v.name] = defaultValueFor(v, k);
    }

    const keysA = Object.keys(values);
    const keysB = Object.keys(next);
    const sameLen = keysA.length === keysB.length;
    const same =
      sameLen &&
      keysA.every((k) => Object.prototype.hasOwnProperty.call(next, k) && Object.is(values[k], next[k]));
    if (!same) onChangeValues(next);
  }, [kinds, onChangeValues, values, variables]);

  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const v of variables) {
      const kind = kindOf(v);
      const val = values[v.name];
      if (v.required && isEmptyValue(kind, val)) out[v.name] = '必填';
      if (kind === 'json') {
        const raw = typeof val === 'string' ? val : '';
        if (raw.trim().length > 0) {
          try {
            JSON.parse(raw);
          } catch {
            out[v.name] = 'JSON 格式错误';
          }
        }
      }
    }
    return out;
  }, [values, variables]);

  useEffect(() => {
    const keys = Object.keys(errors);
    if (keys.length === 0) {
      onValidityChange(true);
      return;
    }
    const reasons = Object.values(errors);
    if (reasons.includes('必填')) onValidityChange(false, '请填写必填变量');
    else if (reasons.includes('JSON 格式错误')) onValidityChange(false, 'JSON 格式错误');
    else onValidityChange(false, '请修正变量填值');
  }, [errors, onValidityChange]);

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-slate-900">变量填值</div>

      {variables.length === 0 ? (
        <div className="text-sm text-slate-500">当前没有变量</div>
      ) : (
        <div className="space-y-3">
          {variables.map((v) => {
            const kind = kindOf(v);
            const val = values[v.name];
            const err = errors[v.name];

            return (
              <div key={v.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-700">
                    <span className="font-mono">{v.name}</span>
                    {v.required ? <span className="ml-1 text-rose-500">*</span> : null}
                  </div>
                  {err ? <div className="text-xs text-rose-600">{err}</div> : null}
                </div>

                {kind === 'string' ? (
                  <Input
                    value={typeof val === 'string' ? val : ''}
                    onChange={(e) => onChangeValues({ ...values, [v.name]: e.target.value })}
                    disabled={disabled}
                    className={cn('h-9 font-mono', err ? 'border-rose-300' : '')}
                  />
                ) : null}

                {kind === 'number' ? (
                  <Input
                    type="number"
                    value={typeof val === 'number' ? val : val === null ? '' : 0}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw.trim() === '') onChangeValues({ ...values, [v.name]: v.required ? 0 : null });
                      else onChangeValues({ ...values, [v.name]: Number(raw) });
                    }}
                    disabled={disabled}
                    className={cn('h-9 font-mono', err ? 'border-rose-300' : '')}
                  />
                ) : null}

                {kind === 'boolean' ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={val === true}
                      onCheckedChange={(checked) => onChangeValues({ ...values, [v.name]: checked })}
                      disabled={disabled}
                    />
                    <div className="text-sm text-slate-600">{val === true ? 'true' : 'false'}</div>
                  </div>
                ) : null}

                {kind === 'enum' ? (
                  <select
                    value={typeof val === 'string' ? val : ''}
                    onChange={(e) => onChangeValues({ ...values, [v.name]: e.target.value })}
                    disabled={disabled}
                    className={cn(
                      'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary',
                      err ? 'border-rose-300' : '',
                    )}
                  >
                    {(v.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : null}

                {kind === 'json' ? (
                  <Textarea
                    value={typeof val === 'string' ? val : ''}
                    onChange={(e) => onChangeValues({ ...values, [v.name]: e.target.value })}
                    disabled={disabled}
                    className={cn('font-mono text-sm', err ? 'border-rose-300' : '')}
                    rows={4}
                  />
                ) : null}

                {v.description ? <div className="text-xs text-slate-500">{v.description}</div> : null}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAdvancedOpen((x) => !x)}
        className="flex w-full items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        高级选项
      </button>

      {advancedOpen ? (
        <div className="space-y-3">
          <div className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-5 text-sm text-slate-600">Temperature 覆盖</div>
            <div className="col-span-7">
              <Input
                type="number"
                step={0.1}
                value={overrides.temperature ?? ''}
                onChange={(e) =>
                  onChangeOverrides({
                    ...overrides,
                    temperature: e.target.value.trim() === '' ? undefined : Number(e.target.value),
                  })
                }
                disabled={disabled}
                className="h-9 font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-5 text-sm text-slate-600">Max Tokens 覆盖</div>
            <div className="col-span-7">
              <Input
                type="number"
                step={1}
                value={overrides.maxTokens ?? ''}
                onChange={(e) =>
                  onChangeOverrides({
                    ...overrides,
                    maxTokens: e.target.value.trim() === '' ? undefined : Number(e.target.value),
                  })
                }
                disabled={disabled}
                className="h-9 font-mono"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
