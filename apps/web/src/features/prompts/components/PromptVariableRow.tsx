'use client';

import { GripVertical, X } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PromptVariable } from '@/types/prompt';

interface RowProps {
  index: number;
  value: PromptVariable;
  onUpdate: (patch: Partial<PromptVariable>) => void;
  onRemove: () => void;
}

const NUM_RE = /^-?\d+(\.\d+)?$/;

type UiType = 'string' | 'number' | 'boolean';

function detectUiType(v: PromptVariable): UiType {
  if (v.type === 'number') return 'number';
  if (v.type === 'select' && Array.isArray(v.options)) {
    const set = new Set(v.options);
    if (set.size === 2 && set.has('true') && set.has('false')) return 'boolean';
  }
  return 'string';
}

function toPatchByUiType(next: UiType): Partial<PromptVariable> {
  if (next === 'number') return { type: 'number' };
  if (next === 'boolean') return { type: 'select', options: ['true', 'false'] };
  return { type: 'text', options: undefined };
}

export function PromptVariableRow({ value, onUpdate, onRemove }: RowProps) {
  const uiType = detectUiType(value);
  const defaultValue = value.defaultValue ?? '';

  const numberInvalid =
    uiType === 'number' && defaultValue.trim().length > 0 && !NUM_RE.test(defaultValue.trim());

  const boolValue = defaultValue === 'true' || defaultValue === 'false' ? defaultValue : '';

  return (
    <div className="relative mb-2 rounded-md border border-slate-200 p-3">
      <div className="grid grid-cols-12 items-center gap-2">
        <div className="col-span-1 hidden items-center justify-center md:flex">
          <GripVertical className="h-4 w-4 opacity-40" />
        </div>

        <div className="col-span-12 font-mono text-sm text-slate-700 md:col-span-3">
          {value.name}
        </div>

        <div className="col-span-6 md:col-span-2">
          <Select
            value={uiType}
            onValueChange={(v) => onUpdate(toPatchByUiType(v as UiType))}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">string</SelectItem>
              <SelectItem value="number">number</SelectItem>
              <SelectItem value="boolean">boolean</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-6 flex items-center gap-2 md:col-span-2">
          <Checkbox
            checked={value.required}
            onCheckedChange={(v) => onUpdate({ required: v === true })}
          />
          <span className="text-sm text-slate-700">必填</span>
        </div>

        <div className="col-span-12 md:col-span-3">
          {uiType === 'boolean' ? (
            <Select
              value={boolValue}
              onValueChange={(v) => onUpdate({ defaultValue: v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="-- 请选择 --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">true</SelectItem>
                <SelectItem value="false">false</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <>
              <Input
                value={defaultValue}
                onChange={(e) => onUpdate({ defaultValue: e.target.value })}
                placeholder="默认值"
                className={cn(
                  'h-9',
                  uiType === 'number' ? 'font-mono' : '',
                  numberInvalid ? 'border-rose-300' : '',
                )}
                inputMode={uiType === 'number' ? 'decimal' : undefined}
              />
              {numberInvalid ? (
                <div className="mt-1 text-xs text-rose-600">需为数字</div>
              ) : null}
            </>
          )}
        </div>

        <div className="col-span-12 flex justify-end md:col-span-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-500 hover:text-rose-600 md:static md:h-9 md:w-9"
            onClick={onRemove}
            title="删除"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="text-xs text-slate-500">描述：</div>
        <Input
          value={value.description ?? ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="可选"
          className="h-9"
        />
      </div>
    </div>
  );
}

