'use client';

import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import type { OrderDetail } from '@/types/admin/order';
import { formatYuanFromFen } from '@/utils/format';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  );
}

export function OrderInfoSection({ order }: { order: OrderDetail }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-base font-semibold text-slate-900">订单信息</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="订单号">
          <span className="font-mono">{order.orderNo}</span>
        </Field>
        <Field label="状态">
          <OrderStatusBadge status={order.status} />
        </Field>
        <Field label="商品总额">{formatYuanFromFen(order.totalAmount)}</Field>
        <Field label="优惠">
          {order.discount > 0 ? `- ${formatYuanFromFen(order.discount)}` : '—'}
        </Field>
        <Field label="实付金额">
          <span className="font-semibold text-indigo-600">
            {formatYuanFromFen(order.payAmount)}
          </span>
        </Field>
        <Field label="备注">{order.remark || '—'}</Field>
      </div>
    </section>
  );
}
