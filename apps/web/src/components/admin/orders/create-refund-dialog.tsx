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
import { formatYuanFromFen } from '@/utils/format';

interface Props {
  open: boolean;
  payAmountFen: number;
  loading: boolean;
  error: string | null;
  onSubmit: (payload: { amountFen: number; reason: string }) => void;
  onClose: () => void;
}

export function CreateRefundDialog({
  open,
  payAmountFen,
  loading,
  error,
  onSubmit,
  onClose,
}: Props) {
  const maxYuan = useMemo(() => payAmountFen / 100, [payAmountFen]);
  const [amountYuan, setAmountYuan] = useState<string>('');
  const [reason, setReason] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmountYuan(maxYuan.toFixed(2));
    setReason('');
    setLocalErr(null);
  }, [open, maxYuan]);

  const reasonLen = reason.length;

  function handleBlurAmount() {
    const n = Number(amountYuan);
    if (!Number.isFinite(n) || n <= 0) return;
    setAmountYuan(n.toFixed(2));
  }

  function handleConfirm() {
    setLocalErr(null);
    const n = Number(amountYuan);
    if (!Number.isFinite(n) || n <= 0) {
      setLocalErr('退款金额必须大于 0');
      return;
    }
    if (n > maxYuan) {
      setLocalErr('退款金额不能超过实付金额');
      return;
    }
    if (!reason.trim()) {
      setLocalErr('请填写退款原因');
      return;
    }
    const fen = Math.round(n * 100);
    onSubmit({ amountFen: fen, reason: reason.trim() });
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
          <DialogTitle>发起退款</DialogTitle>
          <DialogDescription>
            实付金额：<span className="font-medium text-slate-900">{formatYuanFromFen(payAmountFen)}</span>
          </DialogDescription>
        </DialogHeader>

        {(error || localErr) && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error || localErr}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="text-xs text-slate-500">退款金额（元）</div>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amountYuan}
              onChange={(e) => setAmountYuan(e.target.value)}
              onBlur={handleBlurAmount}
              className={cn(
                'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none',
                'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
              )}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">退款原因</div>
              <div className="text-xs text-slate-400">{reasonLen}/200</div>
            </div>
            <textarea
              rows={3}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={cn(
                'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none',
                'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
              )}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? '提交中…' : '确认提交'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
