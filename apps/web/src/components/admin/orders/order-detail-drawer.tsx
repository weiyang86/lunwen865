'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { StageBadge } from '@/components/order/StageBadge';
import { cn } from '@/lib/utils';
import type { OrderDetail } from '@/types/admin/order';
import {
  assignOrderTutor,
  fetchOrderDetail,
  unassignOrderTutor,
  unlinkOrderFromTask,
} from '@/services/admin/orders';
import { getAdminTaskById } from '@/services/admin/tasks';
import { BACKEND_TASK_STAGES, type BackendTaskStage } from '@/types/order';
import { formatDateTime, formatYuanFromFen } from '@/utils/format';
import { OrderItemsTable } from './order-items-table';
import { OrderRefundsList } from './order-refunds-list';
import { OrderTimeline } from './order-timeline';
import { OrderUserSection } from './order-user-section';
import { TaskPickerDialog } from './task-picker-dialog';
import { TutorPickerDialog, type PickedTutor } from './tutor-picker-dialog';

interface Props {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

type TabKey = 'overview' | 'progress' | 'deliverables' | 'refunds' | 'timeline';

export const DEFAULT_ORDER_DETAIL_TAB: TabKey = 'overview';

export function shouldFetchTaskDetail(args: {
  open: boolean;
  tab: TabKey;
  taskId: string | null | undefined;
  hasTaskDetail: boolean;
  taskDetailLoading: boolean;
}): boolean {
  if (!args.open) return false;
  if (args.tab !== 'progress') return false;
  if (!args.taskId) return false;
  if (args.hasTaskDetail) return false;
  if (args.taskDetailLoading) return false;
  return true;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  );
}

export function OrderDetailDrawer({ orderId, open, onClose, onChanged }: Props) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const [tab, setTab] = useState<TabKey>(DEFAULT_ORDER_DETAIL_TAB);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const [tutorPickerOpen, setTutorPickerOpen] = useState(false);
  const [tutorUnassignOpen, setTutorUnassignOpen] = useState(false);
  const [tutorSubmitting, setTutorSubmitting] = useState(false);

  const canClose = !unlinking;

  const refetch = useCallback(async () => {
    if (!orderId) return;
    const rid = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const d = await fetchOrderDetail(orderId);
      if (requestIdRef.current === rid) setData(d);
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '加载失败';
      if (requestIdRef.current === rid) {
        setLoadError(msg);
        setData(null);
      }
    } finally {
      if (requestIdRef.current === rid) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!open || !orderId) return;
    setTab(DEFAULT_ORDER_DETAIL_TAB);
    refetch();
  }, [open, orderId, refetch]);

  function handleClose() {
    if (!canClose) return;
    onClose();
  }

  const taskTitle = data?.thesis?.title ?? null;
  const taskStage = (data?.currentStage ?? null) as BackendTaskStage | null;

  const [taskDetail, setTaskDetail] = useState<any>(null);
  const [taskDetailLoading, setTaskDetailLoading] = useState(false);
  const [taskDetailError, setTaskDetailError] = useState<string | null>(null);

  const loadTaskDetail = useCallback(async () => {
    const taskId = data?.taskId;
    if (!taskId) return;
    setTaskDetailLoading(true);
    setTaskDetailError(null);
    try {
      const res = await getAdminTaskById(taskId);
      setTaskDetail(res);
    } catch {
      setTaskDetail(null);
      setTaskDetailError('加载任务详情失败');
    } finally {
      setTaskDetailLoading(false);
    }
  }, [data?.taskId]);

  useEffect(() => {
    if (!open) return;
    setTaskDetail(null);
    setTaskDetailError(null);
    setTaskDetailLoading(false);
  }, [open, orderId]);

  useEffect(() => {
    if (
      shouldFetchTaskDetail({
        open,
        tab,
        taskId: data?.taskId,
        hasTaskDetail: Boolean(taskDetail),
        taskDetailLoading,
      })
    ) {
      void loadTaskDetail();
    }
  }, [open, tab, data?.taskId, taskDetail, taskDetailLoading, loadTaskDetail]);

  async function confirmUnlink() {
    if (!data) return;
    setUnlinking(true);
    try {
      await unlinkOrderFromTask(data.id);
      toast.success('解绑成功');
      setUnlinkOpen(false);
      await refetch();
      onChanged();
    } catch {
      toast.error('解绑失败');
    } finally {
      setUnlinking(false);
    }
  }

  async function handleTutorPicked(tutor: PickedTutor) {
    if (!data) return;
    setTutorSubmitting(true);
    try {
      await assignOrderTutor(data.id, tutor.id);
      toast.success('指派成功');
      setTutorPickerOpen(false);
      await refetch();
      onChanged();
    } catch {
      toast.error('指派失败');
    } finally {
      setTutorSubmitting(false);
    }
  }

  async function confirmUnassignTutor() {
    if (!data) return;
    setTutorSubmitting(true);
    try {
      await unassignOrderTutor(data.id);
      toast.success('解除成功');
      setTutorUnassignOpen(false);
      await refetch();
      onChanged();
    } catch {
      toast.error('解除失败');
    } finally {
      setTutorSubmitting(false);
    }
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'overview', label: '概览' },
    { key: 'progress', label: '论文进度' },
    { key: 'deliverables', label: '交付物' },
    { key: 'refunds', label: '退款' },
    { key: 'timeline', label: '时间线' },
  ];

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col p-0 shadow-xl sm:max-w-2xl"
      >
        <div className="border-b border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold text-slate-900">订单详情</div>
                {data ? <OrderStatusBadge status={data.status} /> : null}
                <StageBadge stage={taskStage} />
              </div>
              <div className="mt-1 truncate font-mono text-xs text-slate-500">
                {data?.orderNo || orderId || ''}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={!canClose}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {data ? (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="用户">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-900">{data.user.nickname || '—'}</span>
                  <span className="font-mono text-xs text-slate-500">{data.user.id}</span>
                </div>
              </Field>
              <Field label="创建时间">{formatDateTime(data.createdAt)}</Field>
              <Field label="实付金额">
                <span className="font-semibold text-indigo-600">
                  {formatYuanFromFen(data.payAmount)}
                </span>
              </Field>
              <Field label="关联任务">
                {data.taskId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-900">{taskTitle || '—'}</span>
                    <span className="font-mono text-xs text-slate-500">{data.taskId}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700"
                      disabled={unlinking}
                      onClick={() => setUnlinkOpen(true)}
                    >
                      解绑
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500">未绑定</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPickerOpen(true);
                      }}
                    >
                      绑定
                    </Button>
                  </div>
                )}
              </Field>
              <Field label="主导师">
                {data.primaryTutorId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-900">
                      {data.primaryTutor?.name ?? '已指派'}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      {data.primaryTutorId}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={tutorSubmitting}
                      onClick={() => setTutorPickerOpen(true)}
                    >
                      更换
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700"
                      disabled={tutorSubmitting}
                      onClick={() => setTutorUnassignOpen(true)}
                    >
                      解除
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500">未指派</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={tutorSubmitting}
                      onClick={() => setTutorPickerOpen(true)}
                    >
                      指派
                    </Button>
                  </div>
                )}
              </Field>
            </div>
          ) : null}
        </div>

        <div className="border-b border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-2 px-6 py-3">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'rounded-full px-3 py-1 text-sm',
                    tab === t.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : loadError ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white">
              <AlertCircle className="h-6 w-6 text-rose-500" />
              <div className="text-sm text-slate-700">{loadError}</div>
              <Button variant="outline" onClick={refetch}>
                重试
              </Button>
            </div>
          ) : data ? tab === 'overview' ? (
            <div className="space-y-6">
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 text-base font-semibold text-slate-900">订单明细</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="商品总额">{formatYuanFromFen(data.totalAmount)}</Field>
                  <Field label="优惠">
                    {data.discount > 0 ? `- ${formatYuanFromFen(data.discount)}` : '—'}
                  </Field>
                  <Field label="实付金额">{formatYuanFromFen(data.payAmount)}</Field>
                  <Field label="备注">{data.remark || '—'}</Field>
                  <Field label="支付时间">{data.paidAt ? formatDateTime(data.paidAt) : '—'}</Field>
                  <Field label="更新时间">{formatDateTime(data.updatedAt)}</Field>
                  <Field label="完成时间">
                    {data.completedAt ? formatDateTime(data.completedAt) : '—'}
                  </Field>
                  <Field label="取消时间">
                    {data.cancelledAt ? formatDateTime(data.cancelledAt) : '—'}
                  </Field>
                </div>
              </section>

              <OrderUserSection order={data} />
              <OrderItemsTable order={data} />
            </div>
          ) : tab === 'progress' ? (
            <div className="space-y-6">
              {!data.taskId ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-6 py-10 text-center">
                  <div className="text-sm text-slate-700">该订单尚未绑定论文任务</div>
                  <Button
                    variant="outline"
                    onClick={() => setPickerOpen(true)}
                  >
                    前往绑定
                  </Button>
                </div>
              ) : (
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-slate-900">论文进度</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void loadTaskDetail()}
                      disabled={taskDetailLoading}
                    >
                      刷新
                    </Button>
                  </div>

                  {taskDetailLoading ? (
                    <div className="flex h-36 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : taskDetailError ? (
                    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {taskDetailError}
                    </div>
                  ) : (
                    (() => {
                      const task = taskDetail?.task ?? null;
                      if (!task) {
                        return (
                          <div className="text-sm text-slate-500">暂无任务数据</div>
                        );
                      }

                      const stage = (task.currentStage ?? 'TOPIC') as BackendTaskStage;
                      const idx = BACKEND_TASK_STAGES.indexOf(stage);

                      return (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-medium text-slate-900">
                              {task.title || '—'}
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                              {task.educationLevel}
                            </span>
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                              {stage}
                            </span>
                            <span className="font-mono text-xs text-slate-500">{task.id}</span>
                          </div>

                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {BACKEND_TASK_STAGES.map((s, i) => (
                              <span
                                key={s}
                                className={cn(
                                  'shrink-0 rounded-full px-2 py-0.5 text-xs',
                                  i <= idx
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 text-slate-600',
                                )}
                              >
                                {s}
                              </span>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="要求">{task.requirements || '—'}</Field>
                            <Field label="目标字数">
                              {task.totalWordCount ? String(task.totalWordCount) : '—'}
                            </Field>
                            <Field label="截止时间">
                              {task.deadline ? formatDateTime(task.deadline) : '—'}
                            </Field>
                            <Field label="完成时间">
                              {task.completedAt ? formatDateTime(task.completedAt) : '—'}
                            </Field>
                            <Field label="创建时间">{formatDateTime(task.createdAt)}</Field>
                            <Field label="状态">{task.status}</Field>
                          </div>

                          <div>
                            <a
                              href={`/tasks/${task.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-indigo-600 hover:text-indigo-700"
                            >
                              在用户视角查看任务
                            </a>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </section>
              )}
            </div>
          ) : tab === 'deliverables' ? (
            <div className="rounded-lg border border-slate-200 bg-white px-6 py-10 text-center">
              <div className="text-sm font-medium text-slate-900">暂无交付物数据</div>
              <div className="mt-2 text-sm text-slate-500">该功能将在后续迭代提供</div>
            </div>
          ) : tab === 'refunds' ? (
            <div className="space-y-6">
              <div className="text-xs text-slate-500">由订单财务流程驱动，本面板只读</div>
              {data.refunds.length ? (
                <OrderRefundsList refunds={data.refunds} />
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
                  暂无退款记录
                </div>
              )}
            </div>
          ) : (
            <OrderTimeline order={data} />
          ) : null}
        </div>

        {data ? (
          <TaskPickerDialog
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            orderId={data.id}
            orderUserId={data.user.id}
            onLinked={async () => {
              await refetch();
              onChanged();
            }}
          />
        ) : null}

        {data ? (
          <TutorPickerDialog
            open={tutorPickerOpen}
            onClose={() => setTutorPickerOpen(false)}
            title={`为订单 ${data.id} 指派导师`}
            onPicked={handleTutorPicked}
          />
        ) : null}

        <Dialog open={unlinkOpen} onOpenChange={(v) => setUnlinkOpen(v)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>确认解绑？</DialogTitle>
              <DialogDescription>
                订单号：<span className="font-mono">{data?.orderNo ?? '—'}</span>
                <br />
                解绑只会清空订单的 taskId，不会删除任务。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUnlinkOpen(false)} disabled={unlinking}>
                取消
              </Button>
              <Button variant="destructive" onClick={confirmUnlink} disabled={unlinking}>
                {unlinking ? '提交中…' : '确认解绑'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={tutorUnassignOpen} onOpenChange={(v) => setTutorUnassignOpen(v)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>确认解除导师？</DialogTitle>
              <DialogDescription>
                订单号：<span className="font-mono">{data?.orderNo ?? '—'}</span>
                <br />
                解除只会清空订单的 primaryTutorId，不会修改导师账号。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setTutorUnassignOpen(false)}
                disabled={tutorSubmitting}
              >
                取消
              </Button>
              <Button variant="destructive" onClick={confirmUnassignTutor} disabled={tutorSubmitting}>
                {tutorSubmitting ? '提交中…' : '确认解除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
