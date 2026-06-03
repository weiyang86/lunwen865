"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { formatRemainingSeconds } from "@/components/client/payment-ui";
import { clientHttp } from "@/lib/client/api-client";

type OrderDetail = {
  id: string;
  orderNo: string;
  status: string;
  orderStatus?: string;
  paid?: boolean;
  expired?: boolean;
  amountCents: number;
  expiresAt: string;
  expiredAt?: string;
};

function publicStatus(order: OrderDetail, nowMs: number): string {
  if (order.paid) return "PAID";
  if (order.expired) return "EXPIRED";
  const raw = order.orderStatus || order.status;
  if (raw === "CLOSED") return "EXPIRED";
  const expires = Date.parse(order.expiredAt || order.expiresAt || "");
  if (
    (raw === "PENDING" || raw === "PENDING_PAYMENT") &&
    Number.isFinite(expires) &&
    expires <= nowMs
  ) {
    return "EXPIRED";
  }
  return raw;
}

function statusLabel(status: string): string {
  return (
    {
      PENDING: "待支付",
      PENDING_PAYMENT: "待支付",
      PAID: "已支付",
      FULFILLING: "履约中",
      COMPLETED: "已完成",
      CANCELLED: "已取消",
      CLOSED: "已过期",
      EXPIRED: "已过期",
    }[status] ?? status
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!id) return;
    clientHttp
      .get<OrderDetail>(`/orders/${id}`)
      .then(setOrder)
      .catch(() => setOrder(null));
  }, [id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!order) return 0;
    const expires = Date.parse(order.expiredAt || order.expiresAt || "");
    return Number.isFinite(expires)
      ? Math.max(0, Math.floor((expires - nowMs) / 1000))
      : 0;
  }, [order, nowMs]);

  if (!order) return <div className="p-6">加载中...</div>;
  const status = publicStatus(order, nowMs);
  const canPay = status === "PENDING" && remainingSeconds > 0;

  return (
    <div className="space-y-2 p-6">
      <h1 className="text-xl font-semibold">订单确认</h1>
      <div>订单号: {order.orderNo}</div>
      <div>金额: ¥{(order.amountCents / 100).toFixed(2)}</div>
      <div>状态: {statusLabel(status)}</div>
      <div>过期时间: {order.expiredAt || order.expiresAt}</div>
      {canPay ? (
        <div>剩余 {formatRemainingSeconds(remainingSeconds)}</div>
      ) : null}
      {status === "EXPIRED" ? (
        <div className="text-rose-600">订单已过期，请重新下单</div>
      ) : null}
      {canPay ? (
        <button
          className="rounded bg-black px-3 py-2 text-white"
          onClick={() => router.push(`/payments/checkout?orderId=${order.id}`)}
        >
          继续支付
        </button>
      ) : (
        <div>当前状态不可支付</div>
      )}
    </div>
  );
}
