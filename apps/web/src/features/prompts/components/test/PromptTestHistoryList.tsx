'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TestRunRecord } from './PromptTestRunner';

function formatRelative(ms: number) {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  return `${day} 天前`;
}

function prettyJson(x: unknown) {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

function statusBadge(s: TestRunRecord['status']) {
  if (s === 'done') return { text: '完成', cls: 'bg-emerald-100 text-emerald-700' };
  if (s === 'aborted') return { text: '已中止', cls: 'bg-slate-100 text-slate-600' };
  return { text: '失败', cls: 'bg-rose-100 text-rose-700' };
}

function ConfirmDialog({
  open,
  title,
  description,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
                <Dialog.Title className="text-base font-semibold text-slate-900">{title}</Dialog.Title>
                <div className="mt-3 text-sm text-slate-700">{description}</div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>
                    取消
                  </Button>
                  <Button className="bg-rose-600 text-white hover:bg-rose-700" onClick={onConfirm}>
                    确认
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export function PromptTestHistoryList({
  records,
  onClear,
  onLoadValues,
}: {
  records: TestRunRecord[];
  onClear: () => void;
  onLoadValues: (v: Record<string, unknown>) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const ordered = useMemo(() => records.slice(), [records]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (ordered.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        <div className="flex justify-center">
          <History className="h-6 w-6 text-slate-400" />
        </div>
        <div className="mt-2">暂无运行记录</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">仅保留本次会话的 50 条</div>
        <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)}>
          清空历史
        </Button>
      </div>

      <div className="space-y-2">
        {ordered.map((r, idx) => {
          const badge = statusBadge(r.status);
          const open = expanded.has(r.id);
          const varsPreview = Object.entries(r.variableValues)
            .slice(0, 4)
            .map(([k, v]) => `${k}=${String(v)}`)
            .join(', ');
          const outputPreview = r.output.slice(0, 80);

          return (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="text-xs text-slate-400">{idx + 1}.</span>
                  <span className="text-xs text-slate-500">{formatRelative(r.startedAt)}</span>
                  <span className={cn('rounded px-2 py-0.5 text-xs', badge.cls)}>{badge.text}</span>
                  <span className="text-xs text-slate-500">{(r.durationMs / 1000).toFixed(1)}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toggle(r.id)}>
                    {open ? '收起' : '查看'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onLoadValues(r.variableValues);
                      toast.success('已载入参数，请确认后运行');
                    }}
                  >
                    重跑
                  </Button>
                </div>
              </div>

              <div className="mt-2 truncate text-xs text-slate-500">{varsPreview || '—'}</div>
              <div className="mt-1 max-h-10 overflow-hidden text-xs italic text-slate-500">
                {outputPreview || '—'}
              </div>

              {open ? (
                <div className="mt-3 space-y-2">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500">变量</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap break-words">
                      {prettyJson(r.variableValues)}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap break-words">
                    {r.output || '—'}
                  </div>
                  {r.status === 'error' ? (
                    <div className="text-xs text-rose-700">
                      错误: {r.errorCode} {r.errorMessage ? `· ${r.errorMessage}` : ''}
                    </div>
                  ) : null}
                  {r.status === 'done' ? (
                    <div className="text-xs text-slate-500">
                      Tokens: in {r.usage?.inputTokens ?? '-'} · out {r.usage?.outputTokens ?? '-'} ·{' '}
                      {r.finishReason ?? 'stop'}
                    </div>
                  ) : null}
                  <div className="text-xs text-slate-500">
                    模型: {r.modelSnapshot.provider}/{r.modelSnapshot.model}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="清空历史？"
        description="此操作仅影响当前会话内的运行记录。"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onClear();
        }}
      />
    </div>
  );
}
