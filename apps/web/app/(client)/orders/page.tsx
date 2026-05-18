'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ClientPageState } from '@/components/client/client-page-state';
import { Button } from '@/components/ui/button';
import { clientHttp } from '@/lib/client/api-client';
import { formatYuanFromFen } from '@/utils/format';

type ApiOrder = {
  id: string;
  orderNo: string;
  status: string;
  amountCents: number;
  paidAmountCents: number | null;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  remark: string | null;
  productSnapshot: unknown;
  product: {
    id: string;
    name: string;
    coverUrl: string | null;
  };
};

type ApiOrderListResp = {
  items: ApiOrder[];
  total: number;
  page: number;
  pageSize: number;
};

function calcBrainCellsFromSnapshot(snapshot: unknown): number {
  if (!snapshot || typeof snapshot !== 'object') return 0;
  const s = snapshot as Record<string, unknown>;
  const brain = Number(s['brainCellAmount'] ?? 0);
  if (Number.isFinite(brain) && brain > 0) return Math.trunc(brain);
  const fallback =
    Number(s['paperQuota'] ?? 0) +
    Number(s['polishQuota'] ?? 0) +
    Number(s['exportQuota'] ?? 0) +
    Number(s['aiChatQuota'] ?? 0);
  return Number.isFinite(fallback) && fallback > 0 ? Math.trunc(fallback) : 0;
}

function statusLabel(status: string): string {
  return (
    {
      PENDING: '待支付',
      PENDING_PAYMENT: '待支付',
      PAID: '已支付',
      FULFILLING: '履约中',
      COMPLETED: '已完成',
      CANCELLED: '已取消',
      REFUNDING: '退款中',
      REFUNDED: '已退款',
      CLOSED: '已关闭',
    }[status] ?? status
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [brainCellBalance, setBrainCellBalance] = useState<number>(0);

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const list = await clientHttp.get<ApiOrderListResp>('/orders', {
        page: 1,
        pageSize: 50,
      });
      const quota = await clientHttp.get<Record<string, number>>('/quota/me');
      setOrders(Array.isArray(list.items) ? list.items : []);
      setTotal(typeof list.total === 'number' ? list.total : 0);
      setBrainCellBalance(Number(quota?.['BRAIN_CELL'] ?? 0) || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  const state = loading
    ? 'loading'
    : error
      ? 'error'
      : orders.length === 0
        ? 'empty'
        : 'success';

  const paidBrainCells = useMemo(() => {
    return orders
      .filter((o) => o.status === 'COMPLETED' || o.status === 'PAID')
      .reduce((sum, o) => sum + calcBrainCellsFromSnapshot(o.productSnapshot), 0);
  }, [orders]);

  return (
    <ClientPageState
      title="订单"
      state={state}
      emptyMessage="暂无订单记录"
      errorMessage="订单页加载失败"
    >
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">订单</h1>
            <div className="mt-1 text-sm text-slate-600">
              当前脑细胞余额：{brainCellBalance}；累计已获（本页统计）：{paidBrainCells}
            </div>
          </div>
          <Button variant="outline" onClick={() => void refreshAll()} disabled={loading}>
            刷新
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3">
          {orders.map((o) => {
            const brainCells = calcBrainCellsFromSnapshot(o.productSnapshot);
            const canPay = o.status === 'PENDING' || o.status === 'PENDING_PAYMENT';
            return (
              <div
                key={o.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {o.product.coverUrl ? (
                      <img
                        src={o.product.coverUrl}
                        alt={o.product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-slate-900">{o.product.name}</div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {statusLabel(o.status)}
                      </span>
                      {brainCells ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          脑细胞 +{brainCells}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      订单号 {o.orderNo} · 下单 {new Date(o.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">
                      {formatYuanFromFen(o.amountCents)}
                    </div>
                    {o.paidAt ? (
                      <div className="text-xs text-slate-500">
                        支付 {new Date(o.paidAt).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    onClick={() => {
                      if (!canPay) return;
                      if (payingId) return;
                      setPayingId(o.id);
                      void (async () => {
                        try {
                          await clientHttp.post('/payment/sandbox/simulate-paid', {
                            orderId: o.id,
                          });
                          toast.success('已支付（沙箱）');
                          await refreshAll();
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : '支付失败');
                        } finally {
                          setPayingId(null);
                        }
                      })();
                    }}
                    disabled={!canPay || payingId === o.id}
                  >
                    {payingId === o.id ? '支付中...' : canPay ? '支付（沙箱）' : '已完成'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {total > orders.length ? (
          <div className="text-sm text-slate-500">
            当前仅展示最新 {orders.length} 条（共 {total} 条）
          </div>
        ) : null}
      </section>
    </ClientPageState>
  );
}
