'use client';

import { cn } from '@/lib/utils';
import type { OrderDetail } from '@/types/admin/order';
import { formatDateTime } from '@/utils/format';

type Node = { key: string; label: string; time: string };

function buildNodes(order: OrderDetail): Node[] {
  const nodes: Node[] = [];
  nodes.push({ key: 'created', label: '创建订单', time: order.createdAt });
  if (order.paidAt) nodes.push({ key: 'paid', label: '完成支付', time: order.paidAt });
  if (order.completedAt) nodes.push({ key: 'completed', label: '履约完成', time: order.completedAt });
  if (order.cancelledAt) nodes.push({ key: 'cancelled', label: '订单取消', time: order.cancelledAt });

  for (const r of order.refunds) {
    nodes.push({ key: `refund_${r.id}_created`, label: `发起退款（${r.status}）`, time: r.createdAt });
    if (r.resolvedAt) {
      nodes.push({
        key: `refund_${r.id}_resolved`,
        label: `退款处理完成（${r.status}）`,
        time: r.resolvedAt,
      });
    }
  }

  nodes.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return nodes;
}

export function OrderTimeline({ order }: { order: OrderDetail }) {
  const nodes = buildNodes(order);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-base font-semibold text-slate-900">状态时间线</div>
      <div className="space-y-3">
        {nodes.map((n, idx) => {
          const isLast = idx === nodes.length - 1;
          return (
            <div key={n.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-600" />
                {!isLast ? <div className="mt-1 w-px flex-1 bg-slate-200" /> : null}
              </div>
              <div className={cn('flex-1 pb-2', isLast ? 'pb-0' : '')}>
                <div className="text-sm text-slate-900">{n.label}</div>
                <div className="mt-0.5 text-xs text-slate-500">{formatDateTime(n.time)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

