'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import type { ListOrdersQuery, OrderStats, OrderStatus } from '@/types/admin/order';
import { fetchOrders, fetchOrderStats, type ThesisOrderListResp } from '@/services/admin/orders';
import { OrderFilterBar } from '@/components/admin/orders/order-filter-bar';
import { OrderStatusTabs } from '@/components/admin/orders/order-status-tabs';
import { OrderStatsCards } from '@/components/admin/orders/order-stats-cards';
import { OrderTable } from '@/components/admin/orders/order-table';
import { OrderDetailDrawer } from '@/components/admin/orders/order-detail-drawer';
import { UsersPagination } from '@/components/admin/users/users-pagination';

function buildTabCounts(stats: OrderStats | null) {
  const counts: Partial<Record<'ALL' | OrderStatus, number>> = {};
  if (stats) {
    counts.ALL = stats.total;
    counts.PAID = stats.paid;
    counts.REFUNDED = stats.refunded;
  }
  return counts;
}

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spString = searchParams?.toString() ?? '';
  const [query, setQuery] = useState<ListOrdersQuery>({
    page: 1,
    pageSize: 20,
    status: 'ALL',
    keyword: '',
  });
  const [data, setData] = useState<ThesisOrderListResp | null>(null);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(spString);
    const id = sp.get('id') ?? null;
    if (id) {
      setDrawerOrderId(id);
      setDrawerOpen(true);
      return;
    }
    setDrawerOpen(false);
    setTimeout(() => setDrawerOrderId(null), 350);
  }, [spString]);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    fetchOrders(query)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          (e && typeof e === 'object' && 'message' in e
            ? String((e as any).message)
            : null) || '加载订单失败';
        toast.error(msg);
        setData({
          items: [],
          total: 0,
          page: query.page ?? 1,
          pageSize: query.pageSize ?? 20,
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLoadingStats(true);
    fetchOrderStats({ startDate: query.startDate, endDate: query.endDate })
      .then((d) => {
        if (!cancelled) setStats(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          (e && typeof e === 'object' && 'message' in e
            ? String((e as any).message)
            : null) || '加载统计失败';
        toast.error(msg);
        setStats(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingStats(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query.startDate, query.endDate, reloadKey]);

  const tabCounts = useMemo(() => buildTabCounts(stats), [stats]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- 仅依赖 data.items，避免 data 对象引用变化导致不必要的重算/闪烁
  const unlinkedCount = useMemo(() => {
    if (!data?.items?.length) return 0;
    return data.items.reduce((acc, it) => acc + (it.thesis == null ? 1 : 0), 0);
  }, [data?.items]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">订单管理</h1>
        <p className="text-sm text-slate-500">查看与处理所有订单</p>
      </div>

      <OrderStatsCards stats={stats} loading={loadingStats && !stats} />

      <div className="rounded-lg border border-slate-200 bg-white">
        <OrderStatusTabs
          value={query.status ?? 'ALL'}
          counts={tabCounts}
          onChange={(s) => setQuery((q) => ({ ...q, status: s, page: 1 }))}
        />
        <div className="border-b border-slate-100 p-4">
          <OrderFilterBar
            value={query}
            onChange={(patch) => setQuery((q) => ({ ...q, ...patch, page: 1 }))}
          />
        </div>

        {unlinkedCount > 0 ? (
          <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
            {unlinkedCount} / {data?.items.length ?? 0} 条订单未关联论文任务（多为历史订单）。可在订单操作中手动绑定。
          </div>
        ) : null}

        <OrderTable
          data={data?.items ?? []}
          loading={loadingList}
          onRowAction={(row) => {
            const sp = new URLSearchParams(spString);
            sp.set('id', row.id);
            router.replace(`/admin/orders?${sp.toString()}`);
          }}
          onChanged={() => setReloadKey((k) => k + 1)}
        />

        <div className="p-4">
          <UsersPagination
            page={data?.page ?? query.page ?? 1}
            pageSize={data?.pageSize ?? query.pageSize ?? 20}
            total={data?.total ?? 0}
            onChange={(page, pageSize) =>
              setQuery((q) => ({ ...q, page, pageSize }))
            }
          />
        </div>
      </div>

      <OrderDetailDrawer
        open={drawerOpen}
        orderId={drawerOrderId}
        onClose={() => {
          const sp = new URLSearchParams(spString);
          sp.delete('id');
          const qs = sp.toString();
          router.replace(`/admin/orders${qs ? `?${qs}` : ''}`);
        }}
        onChanged={() => {
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}
