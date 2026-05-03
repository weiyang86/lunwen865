'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BusinessHours, BusinessHourSlot } from '@/types/admin/store';

const WEEKDAYS: Array<{ key: number; label: string }> = [
  { key: 1, label: '周一' },
  { key: 2, label: '周二' },
  { key: 3, label: '周三' },
  { key: 4, label: '周四' },
  { key: 5, label: '周五' },
  { key: 6, label: '周六' },
  { key: 0, label: '周日' },
];

function ensureAllDays(hours: BusinessHours): BusinessHours {
  const next: BusinessHours = { ...hours };
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    if (!Array.isArray(next[d])) next[d] = [];
  }
  return next;
}

function defaultSlot(): BusinessHourSlot {
  return { open: '09:00', close: '21:00' };
}

interface Props {
  value: BusinessHours;
  disabled?: boolean;
  onChange: (v: BusinessHours) => void;
}

export function StoreBusinessHoursField({ value, disabled, onChange }: Props) {
  const v = ensureAllDays(value);

  function setDay(day: number, slots: BusinessHourSlot[]) {
    onChange({ ...v, [day]: slots });
  }

  function addSlot(day: number) {
    const slots = v[day] ?? [];
    if (slots.length >= 3) return;
    setDay(day, [...slots, defaultSlot()]);
  }

  function removeSlot(day: number, idx: number) {
    const slots = v[day] ?? [];
    setDay(
      day,
      slots.filter((_, i) => i !== idx),
    );
  }

  function updateSlot(day: number, idx: number, patch: Partial<BusinessHourSlot>) {
    const slots = v[day] ?? [];
    setDay(
      day,
      slots.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  }

  function applyMondayToAll() {
    const mon = v[1] ?? [];
    const next: BusinessHours = { ...v };
    for (const d of [0, 2, 3, 4, 5, 6]) {
      next[d] = mon.map((s) => ({ ...s }));
    }
    onChange(next);
  }

  function applyWorkdays() {
    const next: BusinessHours = { ...v };
    for (const d of [1, 2, 3, 4, 5]) next[d] = [defaultSlot()];
    for (const d of [0, 6]) next[d] = [];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={applyMondayToAll}
          disabled={disabled}
        >
          全部应用周一时段
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={applyWorkdays}
          disabled={disabled}
        >
          工作日营业，周末休息
        </Button>
      </div>

      <div className="space-y-3">
        {WEEKDAYS.map((d) => {
          const slots = v[d.key] ?? [];
          return (
            <div key={d.key} className="rounded-md border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm font-medium text-slate-700">{d.label}</div>
                {slots.length < 3 ? (
                  <button
                    type="button"
                    onClick={() => addSlot(d.key)}
                    disabled={disabled}
                    className={cn(
                      'inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700',
                      disabled ? 'opacity-50' : '',
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    添加营业时段
                  </button>
                ) : null}
              </div>

              {slots.length === 0 ? (
                <div className="mt-2 text-sm text-slate-400">休息</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {slots.map((s, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={s.open}
                        onChange={(e) => updateSlot(d.key, idx, { open: e.target.value })}
                        disabled={disabled}
                        className={cn(
                          'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none',
                          'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                        )}
                      />
                      <span className="text-slate-400">-</span>
                      <input
                        type="time"
                        value={s.close}
                        onChange={(e) => updateSlot(d.key, idx, { close: e.target.value })}
                        disabled={disabled}
                        className={cn(
                          'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none',
                          'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => removeSlot(d.key, idx)}
                        disabled={disabled}
                        className={cn(
                          'inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-3 text-slate-600 hover:bg-slate-50',
                          disabled ? 'opacity-50' : '',
                        )}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

