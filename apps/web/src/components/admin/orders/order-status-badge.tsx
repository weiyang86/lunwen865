'use client';

import type { OrderStatus } from '@/types/admin/order';

export const STATUS_META: Record<OrderStatus, { label: string; cls: string }> = {
  PENDING_PAYMENT: {
    label: '待支付',
    cls: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  },
  PAID: { label: '已支付', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  FULFILLING: {
    label: '履约中',
    cls: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  },
  COMPLETED: {
    label: '已完成',
    cls: 'bg-green-50 text-green-700 ring-green-600/20',
  },
  CANCELLED: { label: '已取消', cls: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
  REFUNDING: {
    label: '退款中',
    cls: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  },
  REFUNDED: { label: '已退款', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}
