'use client';

import { cn } from '@/lib/utils';
import type { Refund } from '@/types/admin/order';
import { formatDateTime, formatYuanFromFen } from '@/utils/format';

const REFUND_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '待审批', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  APPROVED: { label: '已通过', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  REJECTED: { label: '已拒绝', cls: 'bg-slate-100 text-slate-700 ring-slate-500/20' },
  SUCCESS: { label: '成功', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  FAILED: { label: '失败', cls: 'bg-slate-100 text-slate-700 ring-slate-500/20' },
};

function RefundBadge({ status }: { status: string }) {
  const meta = REFUND_BADGE[status] ?? REFUND_BADGE.PENDING;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        meta.cls,
      )}
    >
      {meta.label}
    </span>
  );
}

export function OrderRefundsList({ refunds }: { refunds: Refund[] }) {
  if (!refunds.length) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-base font-semibold text-slate-900">退款记录</div>
      <div className="space-y-3">
        {refunds.map((r) => (
          <div key={r.id} className="rounded-md border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <RefundBadge status={r.status} />
                <span className="text-sm font-medium text-slate-900">
                  {formatYuanFromFen(r.amount)}
                </span>
              </div>
              <div className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</div>
            </div>
            <div className="mt-2 text-sm text-slate-700">
              原因：<span className="text-slate-900">{r.reason}</span>
            </div>
            {r.status === 'REJECTED' && r.rejectReason ? (
              <div className="mt-1 text-sm text-slate-700">
                拒绝原因：<span className="text-slate-900">{r.rejectReason}</span>
              </div>
            ) : null}
            {r.status !== 'PENDING' && r.resolvedAt ? (
              <div className="mt-1 text-xs text-slate-500">
                解决时间：{formatDateTime(r.resolvedAt)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

