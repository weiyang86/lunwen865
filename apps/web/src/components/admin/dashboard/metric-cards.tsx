'use client';

import {
  ArrowDown,
  ArrowUp,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardStats } from '@/types/admin/dashboard';

interface Props {
  metrics: DashboardStats['metrics'];
}

export function MetricCards({ metrics }: Props) {
  const items = [
    {
      key: 'revenue',
      label: '总营收',
      icon: DollarSign,
      value: `¥${metrics.revenue.value.toLocaleString()}`,
      delta: metrics.revenue.delta,
      tone: 'bg-blue-50 text-blue-600',
    },
    {
      key: 'orders',
      label: '订单数',
      icon: ShoppingCart,
      value: metrics.orders.value.toLocaleString(),
      delta: metrics.orders.delta,
      tone: 'bg-emerald-50 text-emerald-600',
    },
    {
      key: 'newUsers',
      label: '新增用户',
      icon: UserPlus,
      value: metrics.newUsers.value.toLocaleString(),
      delta: metrics.newUsers.delta,
      tone: 'bg-violet-50 text-violet-600',
    },
    {
      key: 'conversionRate',
      label: '转化率',
      icon: TrendingUp,
      value: `${metrics.conversionRate.value}%`,
      delta: metrics.conversionRate.delta,
      tone: 'bg-amber-50 text-amber-600',
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => {
        const positive = it.delta >= 0;
        const Icon = it.icon;
        return (
          <div
            key={it.key}
            className="rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="flex items-start justify-between">
              <div className="text-sm text-slate-500">{it.label}</div>
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md',
                  it.tone,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">
              {it.value}
            </div>
            <div
              className={cn(
                'mt-2 flex items-center gap-1 text-xs',
                positive ? 'text-emerald-600' : 'text-red-600',
              )}
            >
              {positive ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              <span>{Math.abs(it.delta)}%</span>
              <span className="text-slate-400">较上周</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

