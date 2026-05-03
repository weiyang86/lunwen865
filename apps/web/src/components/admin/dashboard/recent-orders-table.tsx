'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardStats, OrderStatus } from '@/types/admin/dashboard';

const STATUS_MAP: Record<OrderStatus, { label: string; cls: string }> = {
  PENDING: { label: '待支付', cls: 'bg-amber-50 text-amber-700' },
  PAID: { label: '已支付', cls: 'bg-blue-50 text-blue-700' },
  SHIPPED: { label: '已发货', cls: 'bg-violet-50 text-violet-700' },
  COMPLETED: { label: '已完成', cls: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: '已取消', cls: 'bg-slate-100 text-slate-600' },
};

interface Props {
  orders: DashboardStats['recentOrders'];
}

export function RecentOrdersTable({ orders }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">最近订单</h3>
          <p className="text-xs text-slate-500">最新 10 条订单</p>
        </div>
        <Link
          href="/admin/orders"
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
        >
          查看全部 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">订单号</th>
              <th className="px-5 py-2.5 text-left font-medium">客户</th>
              <th className="px-5 py-2.5 text-right font-medium">金额</th>
              <th className="px-5 py-2.5 text-left font-medium">状态</th>
              <th className="px-5 py-2.5 text-left font-medium">时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => {
              const s = STATUS_MAP[o.status];
              return (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs text-slate-700">
                    {o.id}
                  </td>
                  <td className="px-5 py-3 text-slate-900">{o.customerName}</td>
                  <td className="px-5 py-3 text-right font-medium text-slate-900">
                    ¥{o.amount.toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs',
                        s.cls,
                      )}
                    >
                      {s.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {format(new Date(o.createdAt), 'MM-dd HH:mm')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

