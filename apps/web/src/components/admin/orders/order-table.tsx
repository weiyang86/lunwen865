'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, formatYuanFromFen } from '@/utils/format';
import type { ThesisOrder } from '@/types/order';
import { OrderStatusBadge } from '@/components/order/OrderStatusBadge';
import { StageBadge } from '@/components/order/StageBadge';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { unlinkOrderFromTask } from '@/services/admin/orders';
import { TaskPickerDialog } from './task-picker-dialog';

interface Props {
  data: ThesisOrder[];
  loading: boolean;
  onRowAction: (row: ThesisOrder) => void;
  onChanged: () => void;
}

function initialsOf(user: { nickname: string | null; phone: string | null }) {
  const src = (user.nickname || user.phone || '?').trim();
  return src.slice(0, 1).toUpperCase();
}

function formatEducationLevel(raw?: string) {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v.includes('under') || v.includes('bachelor') || v.includes('本科')) return '本科';
  if (v.includes('master') || v.includes('硕')) return '硕士';
  if (v.includes('phd') || v.includes('doctor') || v.includes('博')) return '博士';
  return raw;
}

export function OrderTable({ data, loading, onRowAction, onChanged }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [unbindOpen, setUnbindOpen] = useState(false);
  const [active, setActive] = useState<ThesisOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!unbindOpen) {
      setSubmitting(false);
      setErr(null);
    }
  }, [unbindOpen]);

  async function handleUnbindConfirm() {
    if (!active) return;
    setSubmitting(true);
    setErr(null);
    try {
      await unlinkOrderFromTask(active.id);
      toast.success('解绑成功');
      setUnbindOpen(false);
      onChanged();
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '解绑失败';
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-b-lg">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow>
              <TableHead className="w-52">订单号</TableHead>
              <TableHead className="min-w-60">论文标题</TableHead>
              <TableHead className="w-24">学历</TableHead>
              <TableHead className="w-28">当前阶段</TableHead>
              <TableHead className="w-32">主导师</TableHead>
              <TableHead>用户</TableHead>
              <TableHead className="w-24">状态</TableHead>
              <TableHead className="w-28 text-right">订单金额</TableHead>
              <TableHead className="w-44">创建时间</TableHead>
              <TableHead className="w-24 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && data.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-14 text-center">
                  <div className="text-sm text-muted-foreground">暂无订单</div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((o) => (
                <TableRow key={o.id} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-sm text-slate-900">
                    {o.orderNo}
                  </TableCell>
                  <TableCell className="min-w-60 max-w-sm">
                    {o.thesis?.title ? (
                      <div className="truncate text-sm text-slate-900" title={o.thesis.title}>
                        {o.thesis.title}
                      </div>
                    ) : (
                      <div className="truncate text-sm text-slate-500" title="未关联论文任务">
                        — 未关联 —
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {o.thesis?.educationLevel ? (
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                        {formatEducationLevel(o.thesis.educationLevel) ?? '—'}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StageBadge stage={o.currentStage} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.primaryTutorId ? (
                      <div className="min-w-0">
                        <div className="truncate text-slate-700">
                          {o.primaryTutor?.name ?? '已指派'}{' '}
                          <span className="font-mono text-slate-500">
                            ({o.primaryTutorId.slice(-6)})
                          </span>
                        </div>
                        {o.primaryTutor?.email ? (
                          <div className="truncate text-xs text-slate-500">{o.primaryTutor.email}</div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-slate-400">未指派</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-xs font-medium text-white">
                        {o.user.avatar ? (
                          <img
                            alt={o.user.nickname || o.user.phone || 'user'}
                            src={o.user.avatar}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initialsOf(o.user)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm text-slate-900">
                          {o.user.nickname || '—'}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {o.user.phone || '—'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900">
                    {formatYuanFromFen(o.payment.paidCents > 0 ? o.payment.paidCents : o.payment.totalCents)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {formatDateTime(o.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => onRowAction(o)}>
                      详情
                    </Button>
                    {o.taskId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => {
                          setActive(o);
                          setUnbindOpen(true);
                        }}
                      >
                        解绑
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActive(o);
                          setPickerOpen(true);
                        }}
                      >
                        绑定任务
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {active ? (
        <TaskPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          orderId={active.id}
          orderUserId={active.user.id}
          onLinked={() => {
            onChanged();
          }}
        />
      ) : null}

      <Dialog
        open={unbindOpen}
        onOpenChange={(v) => {
          setErr(null);
          setUnbindOpen(v);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认解绑？</DialogTitle>
            <DialogDescription>
              订单号：<span className="font-mono">{active?.orderNo ?? '—'}</span>
              <br />
              解绑只会清空订单的 taskId，不会删除任务。
            </DialogDescription>
          </DialogHeader>

          {err && (
            <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {err}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUnbindOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleUnbindConfirm} disabled={submitting}>
              {submitting ? '提交中…' : '确认解绑'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
