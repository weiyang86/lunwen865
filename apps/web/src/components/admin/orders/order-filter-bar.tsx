'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ListOrdersQuery } from '@/types/admin/order';
import { BACKEND_TASK_STAGES, type StageType } from '@/types/order';
import { TutorPickerDialog, type PickedTutor } from './tutor-picker-dialog';

interface Props {
  value: ListOrdersQuery;
  onChange: (patch: Partial<ListOrdersQuery>) => void;
}

function stageLabel(s: StageType) {
  if (s === 'TOPIC') return '题目';
  if (s === 'OPENING') return '开题';
  if (s === 'OUTLINE') return '大纲';
  if (s === 'WRITING') return '写作';
  if (s === 'MERGING') return '合稿';
  if (s === 'FORMATTING') return '排版';
  if (s === 'REVIEW') return '审核';
  return '修改';
}

export function OrderFilterBar({ value, onChange }: Props) {
  const [keyword, setKeyword] = useState(value.keyword ?? '');
  const [tutorPickerOpen, setTutorPickerOpen] = useState(false);
  const [pickedTutor, setPickedTutor] = useState<PickedTutor | null>(null);

  useEffect(() => {
    setKeyword(value.keyword ?? '');
  }, [value.keyword]);

  useEffect(() => {
    if (!value.primaryTutorId) {
      setPickedTutor(null);
      return;
    }
    if (pickedTutor && pickedTutor.id !== value.primaryTutorId) {
      setPickedTutor(null);
    }
  }, [value.primaryTutorId, pickedTutor]);

  useEffect(() => {
    const t = setTimeout(() => {
      const prev = value.keyword ?? '';
      if (prev !== keyword) onChange({ keyword, page: 1 });
    }, 400);
    return () => clearTimeout(t);
  }, [keyword, value.keyword, onChange]);

  const showReset = useMemo(() => {
    return (
      Boolean((value.keyword ?? '').trim()) ||
      Boolean(value.startDate) ||
      Boolean(value.endDate) ||
      Boolean(value.currentStage) ||
      Boolean(value.dueDateBefore) ||
      Boolean((value.primaryTutorId ?? '').trim())
    );
  }, [
    value.keyword,
    value.startDate,
    value.endDate,
    value.currentStage,
    value.dueDateBefore,
    value.primaryTutorId,
  ]);

  return (
    <div className="space-y-3">
      <div className="flex min-h-14 flex-wrap items-center gap-3">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="订单号 / 手机号 / 昵称"
          className={cn(
            'h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none',
            'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
          )}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value.startDate ?? ''}
          onChange={(e) => onChange({ startDate: e.target.value || undefined, page: 1 })}
          className={cn(
            'h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none',
            'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
          )}
        />
        <span className="text-slate-400">~</span>
        <input
          type="date"
          value={value.endDate ?? ''}
          onChange={(e) => onChange({ endDate: e.target.value || undefined, page: 1 })}
          className={cn(
            'h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none',
            'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
          )}
        />
      </div>

      <select
        value={value.currentStage ?? ''}
        onChange={(e) =>
          onChange({
            currentStage: (e.target.value as StageType) || undefined,
            page: 1,
          })
        }
        className={cn(
          'h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none',
          'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
        )}
      >
        <option value="">全部阶段</option>
        {BACKEND_TASK_STAGES.map((s) => (
          <option key={s} value={s}>
            {stageLabel(s)}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={value.dueDateBefore ?? ''}
        onChange={(e) => onChange({ dueDateBefore: e.target.value || undefined, page: 1 })}
        className={cn(
          'h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none',
          'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
        )}
      />

      <div className="flex w-full max-w-xs items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">主导师</div>
          {value.primaryTutorId ? (
            <div className="truncate text-sm text-slate-900">
              {pickedTutor?.name ?? '已选择'}{' '}
              <span className="font-mono text-xs text-slate-500">
                ({value.primaryTutorId.slice(-6)})
              </span>
            </div>
          ) : (
            <div className="text-sm text-slate-500">未筛选</div>
          )}
        </div>
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setTutorPickerOpen(true)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            {value.primaryTutorId ? '更换' : '选择'}
          </button>
          {value.primaryTutorId ? (
            <button
              type="button"
              onClick={() => {
                setPickedTutor(null);
                onChange({ primaryTutorId: undefined, page: 1 });
              }}
              className="ml-2 rounded-md px-2 py-1 text-xs text-slate-500 hover:text-slate-900"
            >
              清空
            </button>
          ) : null}
        </div>
      </div>

      {showReset && (
        <button
          type="button"
          onClick={() =>
            onChange({
              keyword: '',
              startDate: undefined,
              endDate: undefined,
              currentStage: undefined,
              dueDateBefore: undefined,
              primaryTutorId: undefined,
              status: 'ALL',
              page: 1,
            })
          }
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          重置
        </button>
      )}
      </div>

      <TutorPickerDialog
        open={tutorPickerOpen}
        onClose={() => setTutorPickerOpen(false)}
        onPicked={(tutor) => {
          setPickedTutor(tutor);
          onChange({ primaryTutorId: tutor.id, page: 1 });
        }}
      />
    </div>
  );
}
