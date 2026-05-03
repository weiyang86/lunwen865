'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/utils/format';
import { linkOrderToTask } from '@/services/admin/orders';
import {
  listAdminTasks,
  type AdminTaskListItem,
  type ListAdminTasksQuery,
} from '@/services/admin/tasks';

type Props = {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderUserId: string;
  onLinked: (taskId: string) => void;
};

export function buildTaskPickerQuery(args: {
  orderUserId: string;
  search: string;
  unlinkedOnly: boolean;
}): ListAdminTasksQuery {
  return {
    userId: args.orderUserId,
    search: args.search.trim() ? args.search.trim() : undefined,
    unlinkedOnly: args.unlinkedOnly,
    limit: 20,
  };
}

export async function performOrderTaskLink(args: {
  orderId: string;
  taskId: string;
  link: (orderId: string, taskId: string) => Promise<unknown>;
  onLinked: (taskId: string) => void;
}): Promise<void> {
  await args.link(args.orderId, args.taskId);
  args.onLinked(args.taskId);
}

export function TaskPickerDialog({ open, onClose, orderId, orderUserId, onLinked }: Props) {
  const [search, setSearch] = useState('');
  const [unlinkedOnly, setUnlinkedOnly] = useState(true);
  const [items, setItems] = useState<AdminTaskListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [manualTaskId, setManualTaskId] = useState('');
  const canSubmitManual = useMemo(() => Boolean(manualTaskId.trim()), [manualTaskId]);

  const canSubmit = useMemo(
    () => Boolean(selectedTaskId) && !loading && !submitting,
    [selectedTaskId, loading, submitting],
  );

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await listAdminTasks(buildTaskPickerQuery({ orderUserId, search, unlinkedOnly }));
      setItems(res.items ?? []);
      setSelectedTaskId(null);
    } catch {
      setItems([]);
      setErr('任务列表加载失败，可使用下方手动输入 taskId 绑定');
    } finally {
      setLoading(false);
    }
  }, [open, orderUserId, search, unlinkedOnly]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(t);
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setUnlinkedOnly(true);
      setItems([]);
      setErr(null);
      setSelectedTaskId(null);
      setManualTaskId('');
      setLoading(false);
      setSubmitting(false);
    }
  }, [open]);

  async function submit(taskId: string) {
    setSubmitting(true);
    try {
      await performOrderTaskLink({
        orderId,
        taskId,
        link: linkOrderToTask,
        onLinked,
      });
      toast.success('绑定成功');
      onClose();
    } catch {
      toast.error('绑定失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>为订单 {orderId} 绑定论文任务</DialogTitle>
          <DialogDescription>仅显示该用户（{orderUserId}）名下的任务</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="按任务标题搜索"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <label className="flex select-none items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={unlinkedOnly}
                onChange={(e) => setUnlinkedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
              />
              仅显示未绑定的任务
            </label>
          </div>

          {err ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {err}
            </div>
          ) : null}

          <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white">
            {loading ? (
              <div className="flex h-36 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-slate-500">暂无任务</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((t) => {
                  const selected = selectedTaskId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTaskId(t.id)}
                      className={cn(
                        'flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-slate-50',
                        selected ? 'bg-indigo-50' : '',
                      )}
                    >
                      <div
                        className={cn(
                          'mt-1 h-4 w-4 rounded-full border',
                          selected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {t.title || '—'}
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            {t.educationLevel}
                          </span>
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                            {t.currentStage}
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs',
                              t.isLinked
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-emerald-50 text-emerald-700',
                            )}
                          >
                            {t.isLinked ? '已绑定' : '未绑定'}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          <span className="font-mono">{t.id}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <div>
                            截止：{t.deadline ? formatDateTime(t.deadline) : '—'}
                          </div>
                          <div>创建：{formatDateTime(t.createdAt)}</div>
                          {t.isLinked ? (
                            <div className="font-mono">绑定订单：{t.linkedOrderId ?? '—'}</div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <details className="rounded-md border border-slate-200 bg-white">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm text-slate-700">
              手动输入 taskId
            </summary>
            <div className="space-y-3 px-3 pb-3">
              <input
                value={manualTaskId}
                onChange={(e) => setManualTaskId(e.target.value)}
                placeholder="粘贴 taskId（降级用）"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  disabled={!canSubmitManual || submitting}
                  onClick={() => submit(manualTaskId.trim())}
                >
                  确认绑定
                </Button>
              </div>
            </div>
          </details>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={onClose}>
            取消
          </Button>
          <Button disabled={!canSubmit} onClick={() => submit(selectedTaskId!)}>
            确认绑定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
