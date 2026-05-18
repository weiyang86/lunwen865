'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { clientHttp } from '@/lib/client/api-client';
import {
  clearCart,
  getCartSnapshot,
  removeFromCart,
  setCartQuantity,
  setupCartListenersOnce,
  subscribeCart,
  type CartItem,
} from '@/lib/client/cart';
import { formatYuanFromFen } from '@/utils/format';

type CreatedOrder = { id: string; orderNo?: string };

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setupCartListenersOnce();
    setItems(getCartSnapshot());
    const unsub = subscribeCart(() => {
      setItems(getCartSnapshot());
    });
    return () => unsub();
  }, []);

  const totalCents = useMemo(() => {
    return items.reduce((sum, it) => sum + it.priceCents * it.quantity, 0);
  }, [items]);

  async function checkout() {
    if (submitting) return;
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const created: CreatedOrder[] = [];
      for (const it of items) {
        const qty = Math.max(1, Math.min(99, Math.trunc(it.quantity || 1)));
        for (let i = 0; i < qty; i += 1) {
          const o = await clientHttp.post<CreatedOrder>('/orders', {
            productId: it.productId,
            remark: qty > 1 ? `购物车下单 x${qty}` : '购物车下单',
          });
          created.push(o);
        }
      }
      clearCart();
      toast.success(`已创建订单 ${created.length} 笔`);
      window.location.href = '/orders';
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '下单失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">购物车</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="text-sm text-slate-600">购物车为空</div>
          <div className="mt-4">
            <Button asChild>
              <Link href="/products">去选购商品</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">购物车</h1>
          <p className="mt-1 text-sm text-slate-600">
            支持多商品下单。若某商品数量大于 1，会创建多笔订单。
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => clearCart()}
          disabled={submitting}
        >
          清空
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {items.map((it) => (
            <div
              key={it.productId}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {it.coverUrl ? (
                    <img
                      src={it.coverUrl}
                      alt={it.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {it.name}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {formatYuanFromFen(it.priceCents)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() =>
                      setCartQuantity(it.productId, Math.max(1, it.quantity - 1))
                    }
                    disabled={submitting || it.quantity <= 1}
                  >
                    -
                  </Button>
                  <div className="w-10 text-center text-sm font-medium">
                    {it.quantity}
                  </div>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() =>
                      setCartQuantity(it.productId, Math.min(99, it.quantity + 1))
                    }
                    disabled={submitting || it.quantity >= 99}
                  >
                    +
                  </Button>
                </div>

                <div className="w-28 text-right text-sm font-semibold text-slate-900">
                  {formatYuanFromFen(it.priceCents * it.quantity)}
                </div>

                <Button
                  variant="ghost"
                  className="text-rose-600 hover:text-rose-700"
                  onClick={() => removeFromCart(it.productId)}
                  disabled={submitting}
                >
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">结算</div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-600">合计</span>
            <span className="text-lg font-semibold text-slate-900">
              {formatYuanFromFen(totalCents)}
            </span>
          </div>
          <Button
            className="mt-4 w-full"
            onClick={() => void checkout()}
            disabled={submitting}
          >
            {submitting ? '提交中...' : '去结算'}
          </Button>
          <div className="mt-3 text-xs text-slate-500">
            下单后可在“订单”页查看并完成支付。
          </div>
        </div>
      </div>
    </section>
  );
}

