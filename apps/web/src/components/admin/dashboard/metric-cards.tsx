'use client';

import {
  ArrowDown,
  ArrowUp,
  Activity,
  ClipboardList,
  ClipboardCheck,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { DashboardStats } from '@/types/admin/dashboard';

interface Props {
  metrics: DashboardStats['metrics'];
  ops?: DashboardStats['ops'];
}

export function MetricCards({ metrics, ops }: Props) {
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
    <div className="space-y-4">
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

      {ops ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/tasks"
            className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50"
          >
            <div className="flex items-start justify-between">
              <div className="text-sm text-slate-500">进行中任务</div>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <ClipboardList className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">
              {ops.tasks.active.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-slate-400">不含已取消/已完成/失败</div>
          </Link>

          <Link
            href="/admin/tasks"
            className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50"
          >
            <div className="flex items-start justify-between">
              <div className="text-sm text-slate-500">待审核</div>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                <ClipboardCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">
              {ops.tasks.pendingReview.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-slate-400">题目/开题/大纲/摘要</div>
          </Link>

          <Link
            href="/admin/tasks"
            className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50"
          >
            <div className="flex items-start justify-between">
              <div className="text-sm text-slate-500">24h 失败任务</div>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-50 text-rose-700">
                <ClipboardList className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">
              {ops.tasks.failed24h.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-slate-400">按任务 updatedAt 统计</div>
          </Link>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="text-sm text-slate-500">AI 24h 失败率</div>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-violet-50 text-violet-700">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">
              {ops.ai.failureRate}%
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {ops.ai.failed24h.toLocaleString()} / {ops.ai.runs24h.toLocaleString()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
