'use client';

import { RefreshCw } from 'lucide-react';
import { useDashboard } from '@/hooks/admin/use-dashboard';
import { DashboardSkeleton } from '@/components/admin/dashboard/dashboard-skeleton';
import { MetricCards } from '@/components/admin/dashboard/metric-cards';
import { RevenueChart } from '@/components/admin/dashboard/revenue-chart';
import { RecentOrdersTable } from '@/components/admin/dashboard/recent-orders-table';

export default function DashboardPage() {
  const { data, loading, error, reload } = useDashboard();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">仪表盘</h1>
          <p className="text-sm text-slate-500">数据概览与近期动态</p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !data ? (
        <DashboardSkeleton />
      ) : data ? (
        <>
          <MetricCards metrics={data.metrics} />
          <RevenueChart data={data.trend} />
          <RecentOrdersTable orders={data.recentOrders} />
        </>
      ) : null}
    </div>
  );
}
