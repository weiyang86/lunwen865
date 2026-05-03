'use client';

import { Badge } from '@/components/ui/badge';
import type { ThesisOrderStatus } from '@/types/order';

const META: Record<ThesisOrderStatus, { label: string; className: string }> = {
  pending_deposit: {
    label: '待付定金',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  },
  pending_final_payment: {
    label: '待付尾款',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  },
  in_progress: {
    label: '进行中',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  },
  completed: {
    label: '已完成',
    className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  },
  cancelled: {
    label: '已取消',
    className: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
  },
  after_sale: {
    label: '售后中',
    className: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  },
  refunding: {
    label: '退款中',
    className: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  },
  refunded: {
    label: '已退款',
    className: 'bg-rose-100 text-rose-800 hover:bg-rose-100',
  },
};

export function OrderStatusBadge({ status }: { status: ThesisOrderStatus | null }) {
  if (!status) return <span className="text-slate-400">—</span>;
  const meta = META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

