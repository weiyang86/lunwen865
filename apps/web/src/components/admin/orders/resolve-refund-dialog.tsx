'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Refund } from '@/types/admin/order';
import { formatDateTime, formatYuanFromFen } from '@/utils/format';

type Choice = 'APPROVED' | 'REJECTED';

interface Props {
  open: boolean;
  refund: Refund | null;
  defaultChoice?: Choice;
  loading: boolean;
  error: string | null;
  onConfirm: (payload: { action: 'APPROVED' } | { action: 'REJECTED'; rejectReason: string }) => void;
  onClose: () => void;
}

export function ResolveRefundDialog({
  open,
  refund,
  defaultChoice = 'APPROVED',
  loading,
  error,
  onConfirm,
  onClose,
}: Props) {
  const [choice, setChoice] = useState<Choice>('APPROVED');
  const [rejectReason, setRejectReason] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChoice(defaultChoice);
    setRejectReason('');
    setLocalErr(null);
  }, [open, defaultChoice]);

  const showReject = choice === 'REJECTED';
  const canSubmit = useMemo(() => {
    if (!refund) return false;
    if (choice === 'APPROVED') return true;
    return Boolean(rejectReason.trim());
  }, [refund, choice, rejectReason]);

  if (!refund) return null;

  function handleSubmit() {
    setLocalErr(null);
    if (choice === 'REJECTED' && !rejectReason.trim()) {
      setLocalErr('拒绝时必须填写原因');
      return;
    }
    if (choice === 'APPROVED') onConfirm({ action: 'APPROVED' });
    else onConfirm({ action: 'REJECTED', rejectReason: rejectReason.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!loading ? (v ? null : onClose()) : null)}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (loading) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (loading) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>审批退款</DialogTitle>
          <DialogDescription>请确认是否通过该退款申请</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="text-slate-600">金额</div>
            <div className="font-medium text-slate-900">{formatYuanFromFen(refund.amount)}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-slate-600">原因</div>
            <div className="max-w-xs truncate text-slate-900">{refund.reason}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-slate-600">创建时间</div>
            <div className="text-slate-900">{formatDateTime(refund.createdAt)}</div>
          </div>
        </div>

        {(error || localErr) && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error || localErr}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setChoice('APPROVED')}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                choice === 'APPROVED'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}
              disabled={loading}
            >
              通过
            </button>
            <button
              type="button"
              onClick={() => setChoice('REJECTED')}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                choice === 'REJECTED'
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}
              disabled={loading}
            >
              拒绝
            </button>
          </div>

          {showReject && (
            <div className="space-y-1.5">
              <div className="text-xs text-slate-500">拒绝原因</div>
              <textarea
                rows={3}
                maxLength={200}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className={cn(
                  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none',
                  'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                )}
                disabled={loading}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            variant={choice === 'REJECTED' ? 'destructive' : 'default'}
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
          >
            {loading ? '提交中…' : choice === 'REJECTED' ? '确认拒绝' : '确认通过'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
