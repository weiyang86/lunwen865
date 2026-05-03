'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { fetchUsers } from '@/services/admin/users';
import {
  addAdminTaskNote,
  assignAdminTask,
  getAdminTaskById,
  overrideAdminTaskStatus,
  unassignAdminTask,
  type BackendTaskStatus,
} from '@/services/admin/tasks';
import { linkOrderToTask, unlinkOrderFromTask } from '@/services/admin/orders';
import { formatDateTime, formatYuanFromFen } from '@/utils/format';
import { StageBadge } from '@/components/order/StageBadge';
import { TaskStatusBadge } from './task-status-badge';

type TabKey = 'basic' | 'orders' | 'timeline';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  );
}

function normalizeOrderStatus(raw: string): string {
  if (raw === 'PENDING' || raw === 'PENDING_PAYMENT') return 'PENDING_PAYMENT';
  if (raw === 'PAID') return 'PAID';
  if (raw === 'FULFILLING') return 'FULFILLING';
  if (raw === 'COMPLETED') return 'COMPLETED';
  if (raw === 'CANCELLED' || raw === 'CLOSED') return 'CANCELLED';
  if (raw === 'REFUNDING') return 'REFUNDING';
  return 'REFUNDED';
}

type Props = {
  open: boolean;
  taskId: string | null;
  action?: 'assign' | 'override' | 'note' | null;
  onClearAction?: () => void;
  onClose: () => void;
  onOpenOrder: (orderId: string) => void;
};

const STATUS_OPTIONS: Array<{ value: BackendTaskStatus; label: string }> = [
  { value: 'INIT', label: '待开始' },
  { value: 'TOPIC_GENERATING', label: '题目生成中' },
  { value: 'TOPIC_PENDING_REVIEW', label: '题目待审核' },
  { value: 'TOPIC_APPROVED', label: '题目已通过' },
  { value: 'OPENING_GENERATING', label: '开题生成中' },
  { value: 'OPENING_PENDING_REVIEW', label: '开题待审核' },
  { value: 'OPENING_APPROVED', label: '开题已通过' },
  { value: 'OUTLINE_GENERATING', label: '大纲生成中' },
  { value: 'OUTLINE_PENDING_REVIEW', label: '大纲待审核' },
  { value: 'OUTLINE_APPROVED', label: '大纲已通过' },
  { value: 'WRITING', label: '写作中' },
  { value: 'WRITING_PAUSED', label: '写作暂停' },
  { value: 'MERGING', label: '合稿中' },
  { value: 'FORMATTING', label: '排版中' },
  { value: 'REVIEW', label: '审核中' },
  { value: 'REVISION', label: '修改中' },
  { value: 'DONE', label: '已完成' },
  { value: 'FAILED', label: '失败' },
  { value: 'CANCELLED', label: '已取消' },
];

function actionLabel(a: string) {
  if (a === 'ASSIGN') return '指派处理人';
  if (a === 'UNASSIGN') return '解除指派';
  if (a === 'OVERRIDE_STATUS') return '覆写状态';
  if (a === 'ADD_NOTE') return '添加备注';
  if (a === 'LINK_ORDER') return '绑定订单';
  if (a === 'UNLINK_ORDER') return '解绑订单';
  return a;
}

export function TaskDetailDrawer({
  open,
  taskId,
  action,
  onClearAction,
  onClose,
  onOpenOrder,
}: Props) {
  const [tab, setTab] = useState<TabKey>('basic');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const [saving, setSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirmUnassignOpen, setConfirmUnassignOpen] = useState(false);
  const [confirmOverrideOpen, setConfirmOverrideOpen] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [pendingUnlinkOrderId, setPendingUnlinkOrderId] = useState<string | null>(null);

  const [assigneeKeyword, setAssigneeKeyword] = useState('');
  const [assigneeIdInput, setAssigneeIdInput] = useState('');
  const [assigneeResults, setAssigneeResults] = useState<any[]>([]);
  const [assigneeLoading, setAssigneeLoading] = useState(false);

  const [overrideTarget, setOverrideTarget] = useState<BackendTaskStatus>('INIT');
  const [overrideReason, setOverrideReason] = useState('');

  const [noteContent, setNoteContent] = useState('');
  const [linkOrderId, setLinkOrderId] = useState('');

  const refetch = useCallback(async () => {
    if (!taskId) return;
    const rid = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const d = await getAdminTaskById(taskId);
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
  }, [taskId]);

  useEffect(() => {
    if (!open || !taskId) return;
    setTab('basic');
    void refetch();
  }, [open, taskId, refetch]);

  useEffect(() => {
    if (!open) {
      setData(null);
      setLoadError(null);
      setLoading(false);
      setTab('basic');
    }
  }, [open]);

  const task = data?.task ?? null;
  const orders: any[] = Array.isArray(data?.orders) ? data.orders : [];
  const assignee = data?.assignee ?? null;
  const adminLogs: any[] = Array.isArray(data?.adminLogs) ? data.adminLogs : [];

  const orderCount = orders.length;
  const status = task?.status ?? 'INIT';
  const stage = task?.currentStage ?? task?.stage ?? null;

  const title = task?.title ?? null;
  const createdAt = task?.createdAt ?? null;
  const updatedAt = task?.updatedAt ?? null;

  const tabs = useMemo(
    () =>
      [
        { key: 'basic' as const, label: '基本信息' },
        { key: 'orders' as const, label: `关联订单${orderCount ? ` (${orderCount})` : ''}` },
        { key: 'timeline' as const, label: '时间线' },
      ] as const,
    [orderCount],
  );

  function handleClose() {
    onClose();
  }

  useEffect(() => {
    if (!open || !taskId) return;
    if (!action) return;
    if (action === 'assign') setAssignOpen(true);
    if (action === 'override') setOverrideOpen(true);
    if (action === 'note') setNoteOpen(true);
    onClearAction?.();
  }, [open, taskId, action, onClearAction]);

  async function loadAssignees() {
    setAssigneeLoading(true);
    try {
      const res = await fetchUsers({
        page: 1,
        pageSize: 20,
        keyword: assigneeKeyword.trim() || undefined,
      } as any);
      setAssigneeResults(res.items ?? []);
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '加载用户失败';
      toast.error(msg);
      setAssigneeResults([]);
    } finally {
      setAssigneeLoading(false);
    }
  }

  async function doAssign(id: string) {
    if (!taskId) return;
    const v = id.trim();
    if (!v) return;
    setSaving(true);
    try {
      const next = await assignAdminTask(taskId, v);
      setData(next);
      toast.success('已指派处理人');
      setAssignOpen(false);
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '指派失败';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function doUnassign() {
    if (!taskId) return;
    setSaving(true);
    try {
      const next = await unassignAdminTask(taskId);
      setData(next);
      toast.success('已解除指派');
      setConfirmUnassignOpen(false);
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '解除失败';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function doOverrideStatus() {
    if (!taskId) return;
    setSaving(true);
    try {
      const next = await overrideAdminTaskStatus({
        id: taskId,
        targetStatus: overrideTarget,
        reason: overrideReason,
      });
      setData(next);
      toast.success('已覆写状态');
      setConfirmOverrideOpen(false);
      setOverrideOpen(false);
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '覆写失败';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function doAddNote() {
    if (!taskId) return;
    const v = noteContent.trim();
    if (!v) return;
    setSaving(true);
    try {
      const next = await addAdminTaskNote({ id: taskId, content: v });
      setData(next);
      toast.success('已添加备注');
      setNoteOpen(false);
      setNoteContent('');
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '添加失败';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function doLinkOrder() {
    if (!taskId) return;
    const v = linkOrderId.trim();
    if (!v) return;
    setSaving(true);
    try {
      await linkOrderToTask(v, taskId);
      toast.success('已绑定订单');
      setLinkOrderId('');
      await refetch();
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '绑定失败';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function doUnlinkOrder(orderId: string) {
    setSaving(true);
    try {
      await unlinkOrderFromTask(orderId);
      toast.success('已解绑订单');
      setConfirmUnlinkOpen(false);
      await refetch();
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '解绑失败';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => (!v ? handleClose() : null)}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col p-0 shadow-xl sm:max-w-2xl"
      >
        <div className="border-b border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold text-slate-900">任务详情</div>
                {task ? <TaskStatusBadge status={status} /> : null}
                <StageBadge stage={stage} />
              </div>
              <div className="mt-1 truncate font-mono text-xs text-slate-500">
                {task?.id || taskId || ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {task ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)} disabled={saving}>
                    更换处理人
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setOverrideOpen(true)} disabled={saving}>
                    覆写状态
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)} disabled={saving}>
                    添加备注
                  </Button>
                </>
              ) : null}
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {task ? (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="标题">{title || '—'}</Field>
              <Field label="创建时间">{createdAt ? formatDateTime(createdAt) : '—'}</Field>
              <Field label="更新时间">{updatedAt ? formatDateTime(updatedAt) : '—'}</Field>
              <Field label="创建者">
                <span className="font-mono text-xs text-slate-500">
                  {task.userId ?? '—'}
                </span>
              </Field>
              <Field label="当前指派人">
                {assignee ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-slate-900">{assignee.name}</div>
                      <div className="truncate font-mono text-xs text-slate-500">
                        {assignee.email || assignee.id}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmUnassignOpen(true)}
                      disabled={saving}
                    >
                      解除
                    </Button>
                  </div>
                ) : (
                  '—'
                )}
              </Field>
              <Field label="关联订单数">
                <button
                  type="button"
                  className="text-sm text-indigo-600 hover:text-indigo-700"
                  onClick={() => setTab('orders')}
                  disabled={orderCount === 0}
                >
                  {orderCount}
                </button>
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
          ) : task ? tab === 'basic' ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-base font-semibold text-slate-900">基本信息</div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="任务编号">
                  <span className="font-mono text-xs text-slate-500">{task.id}</span>
                </Field>
                <Field label="任务状态">
                  <TaskStatusBadge status={status} />
                </Field>
                <Field label="当前阶段">
                  <StageBadge stage={stage} />
                </Field>
                <Field label="学校ID">
                  <span className="font-mono text-xs text-slate-500">{task.schoolId ?? '—'}</span>
                </Field>
                <Field label="专业">{task.major ?? '—'}</Field>
                <Field label="学历">{task.educationLevel ?? '—'}</Field>
                <Field label="目标字数">
                  {task.totalWordCount != null ? String(task.totalWordCount) : '—'}
                </Field>
                <Field label="截止时间">{task.deadline ? formatDateTime(task.deadline) : '—'}</Field>
                <Field label="完成时间">
                  {task.completedAt ? formatDateTime(task.completedAt) : '—'}
                </Field>
              </div>
              <div className="mt-4">
                <Field label="需求 / 描述">
                  <div className="whitespace-pre-wrap break-words text-sm text-slate-700">
                    {task.requirements ?? '—'}
                  </div>
                </Field>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-900">管理备注</div>
                  <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)} disabled={saving}>
                    添加备注
                  </Button>
                </div>
                {adminLogs.filter((l) => String(l.action) === 'ADD_NOTE').length === 0 ? (
                  <div className="mt-2 text-sm text-slate-500">暂无备注</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {adminLogs
                      .filter((l) => String(l.action) === 'ADD_NOTE')
                      .map((l) => (
                        <div key={String(l.id)} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-xs text-slate-500">
                              {l.operator?.name || l.operator?.id || '—'}
                            </div>
                            <div className="font-mono text-xs text-slate-500">
                              {formatDateTime(l.createdAt)}
                            </div>
                          </div>
                          <div className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                            {l.content}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </section>
          ) : tab === 'orders' ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-slate-900">关联订单</div>
                <Button variant="outline" size="sm" onClick={refetch}>
                  刷新
                </Button>
              </div>
              {orders.length === 0 ? (
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                    暂无关联订单
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="text-sm font-medium text-slate-900">绑定订单</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        value={linkOrderId}
                        onChange={(e) => setLinkOrderId(e.target.value)}
                        placeholder="输入订单ID"
                        className="w-72"
                      />
                      <Button onClick={doLinkOrder} disabled={saving || !linkOrderId.trim()}>
                        绑定
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        <th className="py-2 pr-4">订单号</th>
                        <th className="py-2 pr-4">状态</th>
                        <th className="py-2 pr-4">用户</th>
                        <th className="py-2 pr-4 text-right">金额</th>
                        <th className="py-2 pr-0 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map((o) => {
                        const status = normalizeOrderStatus(String(o.status ?? 'PENDING'));
                        const pay = Number(o.paidAmountCents ?? o.amountCents ?? 0);
                        const user = o.user ?? null;
                        return (
                          <tr
                            key={String(o.id)}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => onOpenOrder(String(o.id))}
                          >
                            <td className="py-2 pr-4 font-mono">{String(o.orderNo ?? o.id)}</td>
                            <td className="py-2 pr-4">{status}</td>
                            <td className="py-2 pr-4">
                              <div className="min-w-0">
                                <div className="truncate text-slate-900">
                                  {user?.nickname || '—'}
                                </div>
                                <div className="truncate font-mono text-xs text-slate-500">
                                  {user?.phone || user?.id || '—'}
                                </div>
                              </div>
                            </td>
                            <td className="py-2 pr-4 text-right font-medium text-slate-900">
                              {formatYuanFromFen(pay)}
                            </td>
                            <td className="py-2 pr-0 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingUnlinkOrderId(String(o.id));
                                  setConfirmUnlinkOpen(true);
                                }}
                                disabled={saving}
                              >
                                解绑
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-base font-semibold text-slate-900">时间线</div>
              <div className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-slate-700">创建</div>
                    <div className="font-mono text-xs text-slate-500">
                      {createdAt ? formatDateTime(createdAt) : '—'}
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-slate-700">更新</div>
                    <div className="font-mono text-xs text-slate-500">
                      {updatedAt ? formatDateTime(updatedAt) : '—'}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <div className="text-sm font-medium text-slate-900">管理操作记录</div>
                  {adminLogs.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-500">暂无记录</div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {adminLogs.map((l) => (
                        <div key={String(l.id)} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-medium text-slate-900">{actionLabel(String(l.action))}</div>
                            <div className="font-mono text-xs text-slate-500">{formatDateTime(l.createdAt)}</div>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            操作人：{l.operator?.name || l.operator?.id || '—'}
                          </div>
                          {l.reason ? (
                            <div className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                              原因：{l.reason}
                            </div>
                          ) : null}
                          {l.content ? (
                            <div className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                              备注：{l.content}
                            </div>
                          ) : null}
                          {l.fromStatus || l.toStatus ? (
                            <div className="mt-2 text-xs text-slate-500">
                              状态：{l.fromStatus || '—'} → {l.toStatus || '—'}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <TaskActionDialogs
          openAssign={assignOpen}
          setOpenAssign={setAssignOpen}
          openOverride={overrideOpen}
          setOpenOverride={setOverrideOpen}
          openNote={noteOpen}
          setOpenNote={setNoteOpen}
          openConfirmUnassign={confirmUnassignOpen}
          setOpenConfirmUnassign={setConfirmUnassignOpen}
          openConfirmOverride={confirmOverrideOpen}
          setOpenConfirmOverride={setConfirmOverrideOpen}
          openConfirmUnlink={confirmUnlinkOpen}
          setOpenConfirmUnlink={setConfirmUnlinkOpen}
          saving={saving}
          assigneeKeyword={assigneeKeyword}
          setAssigneeKeyword={setAssigneeKeyword}
          assigneeIdInput={assigneeIdInput}
          setAssigneeIdInput={setAssigneeIdInput}
          assigneeResults={assigneeResults}
          assigneeLoading={assigneeLoading}
          onLoadAssignees={loadAssignees}
          onAssign={doAssign}
          onUnassign={doUnassign}
          overrideTarget={overrideTarget}
          setOverrideTarget={setOverrideTarget}
          overrideReason={overrideReason}
          setOverrideReason={setOverrideReason}
          onRequestOverride={() => setConfirmOverrideOpen(true)}
          onConfirmOverride={doOverrideStatus}
          noteContent={noteContent}
          setNoteContent={setNoteContent}
          onAddNote={doAddNote}
          onUnlink={() => {
            const id = pendingUnlinkOrderId ?? (orders[0]?.id ? String(orders[0].id) : null);
            if (!id) return;
            void doUnlinkOrder(id);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  confirmVariant,
  loading,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  confirmVariant?: 'default' | 'destructive';
  loading: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-slate-600">{description}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button variant={confirmVariant ?? 'default'} onClick={onConfirm} disabled={loading}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TaskActionDialogs({
  openAssign,
  setOpenAssign,
  openOverride,
  setOpenOverride,
  openNote,
  setOpenNote,
  openConfirmUnassign,
  setOpenConfirmUnassign,
  openConfirmOverride,
  setOpenConfirmOverride,
  openConfirmUnlink,
  setOpenConfirmUnlink,
  saving,
  assigneeKeyword,
  setAssigneeKeyword,
  assigneeIdInput,
  setAssigneeIdInput,
  assigneeResults,
  assigneeLoading,
  onLoadAssignees,
  onAssign,
  onUnassign,
  overrideTarget,
  setOverrideTarget,
  overrideReason,
  setOverrideReason,
  onRequestOverride,
  onConfirmOverride,
  noteContent,
  setNoteContent,
  onAddNote,
  onUnlink,
}: {
  openAssign: boolean;
  setOpenAssign: (v: boolean) => void;
  openOverride: boolean;
  setOpenOverride: (v: boolean) => void;
  openNote: boolean;
  setOpenNote: (v: boolean) => void;
  openConfirmUnassign: boolean;
  setOpenConfirmUnassign: (v: boolean) => void;
  openConfirmOverride: boolean;
  setOpenConfirmOverride: (v: boolean) => void;
  openConfirmUnlink: boolean;
  setOpenConfirmUnlink: (v: boolean) => void;
  saving: boolean;
  assigneeKeyword: string;
  setAssigneeKeyword: (v: string) => void;
  assigneeIdInput: string;
  setAssigneeIdInput: (v: string) => void;
  assigneeResults: any[];
  assigneeLoading: boolean;
  onLoadAssignees: () => void;
  onAssign: (assigneeId: string) => void;
  onUnassign: () => void;
  overrideTarget: BackendTaskStatus;
  setOverrideTarget: (v: BackendTaskStatus) => void;
  overrideReason: string;
  setOverrideReason: (v: string) => void;
  onRequestOverride: () => void;
  onConfirmOverride: () => void;
  noteContent: string;
  setNoteContent: (v: string) => void;
  onAddNote: () => void;
  onUnlink: () => void;
}) {
  return (
    <>
      <Dialog open={openAssign} onOpenChange={setOpenAssign}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>更换处理人</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">搜索用户</div>
              <div className="flex items-center gap-2">
                <Input
                  value={assigneeKeyword}
                  onChange={(e) => setAssigneeKeyword(e.target.value)}
                  placeholder="手机号 / 邮箱 / 昵称 / 用户ID"
                />
                <Button variant="outline" onClick={onLoadAssignees} disabled={assigneeLoading || saving}>
                  {assigneeLoading ? '加载中' : '搜索'}
                </Button>
              </div>
            </div>
            <div className="max-h-60 overflow-auto rounded-md border border-slate-200">
              {assigneeResults.length === 0 ? (
                <div className="p-3 text-sm text-slate-500">暂无结果</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {assigneeResults.map((u) => (
                    <button
                      key={String(u.id)}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50"
                      onClick={() => onAssign(String(u.id))}
                      disabled={saving}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {u.nickname || u.email || u.phone || u.id}
                        </div>
                        <div className="truncate font-mono text-xs text-slate-500">{u.id}</div>
                      </div>
                      <div className="text-xs text-slate-500">{u.role}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500">或手动输入用户ID</div>
              <div className="flex items-center gap-2">
                <Input
                  value={assigneeIdInput}
                  onChange={(e) => setAssigneeIdInput(e.target.value)}
                  placeholder="用户ID"
                />
                <Button onClick={() => onAssign(assigneeIdInput)} disabled={saving || !assigneeIdInput.trim()}>
                  指派
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAssign(false)} disabled={saving}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openOverride} onOpenChange={setOpenOverride}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>覆写任务状态</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">目标状态</div>
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={overrideTarget}
                onChange={(e) => setOverrideTarget(e.target.value as BackendTaskStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} ({s.value})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500">原因（必填）</div>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="请填写覆写原因（将记录到审计日志）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenOverride(false)} disabled={saving}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={onRequestOverride}
              disabled={saving || !overrideReason.trim()}
            >
              下一步确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openNote} onOpenChange={setOpenNote}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>添加管理备注</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">内容</div>
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="仅后台可见，将记录到审计日志"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNote(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={onAddNote} disabled={saving || !noteContent.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={openConfirmUnassign}
        onOpenChange={setOpenConfirmUnassign}
        title="确认解除指派？"
        description="解除指派会清空当前处理人，并写入审计日志。"
        confirmText="确认解除"
        confirmVariant="destructive"
        loading={saving}
        onConfirm={onUnassign}
      />

      <ConfirmDialog
        open={openConfirmOverride}
        onOpenChange={setOpenConfirmOverride}
        title="确认覆写状态？"
        description="该操作会直接覆写任务状态，并写入审计日志（含原因）。"
        confirmText="确认覆写"
        confirmVariant="destructive"
        loading={saving}
        onConfirm={onConfirmOverride}
      />

      <ConfirmDialog
        open={openConfirmUnlink}
        onOpenChange={setOpenConfirmUnlink}
        title="确认解绑订单？"
        description="解绑会解除订单与任务的关联，并写入审计日志。"
        confirmText="确认解绑"
        confirmVariant="destructive"
        loading={saving}
        onConfirm={onUnlink}
      />
    </>
  );
}
