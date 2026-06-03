"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { clientHttp } from "@/lib/client/api-client";
import { getApiErrorMessage } from "@/lib/client/api-error";

type PaymentStatusResp = {
  status: string;
  orderStatus?: string;
  paymentStatus?: string;
  paid?: boolean;
  expired?: boolean;
  remainingSeconds?: number;
  message?: string;
  paidAt?: string | null;
  orderNo?: string;
};

function statusText(status?: string): string {
  if (!status) return "未知状态";
  return (
    {
      PENDING: "待支付",
      PENDING_PAYMENT: "待支付",
      PAID: "已支付",
      COMPLETED: "已完成",
      CANCELLED: "已取消",
      CLOSED: "已过期",
      EXPIRED: "已过期",
      REFUNDING: "退款中",
      REFUNDED: "已退款",
    }[status] ?? status
  );
}

export default function PaymentResultPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const orderId = sp?.get("orderId") || "";

  const [data, setData] = useState<PaymentStatusResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const shouldPoll = useMemo(
    () =>
      data?.status === "PENDING" ||
      data?.status === "PENDING_PAYMENT" ||
      data === null,
    [data],
  );

  const refresh = useCallback(async () => {
    if (!orderId) {
      setError("缺少订单号，请返回订单页查看支付状态。");
      setLoading(false);
      return;
    }
    try {
      const s = await clientHttp.post<PaymentStatusResp>(
        `/payment/orders/${orderId}/status/refresh`,
        {},
      );
      setData(s);
      setError(null);
      if (s.status === "PAID" || s.status === "COMPLETED") {
        router.replace("/account");
      }
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "查询支付状态失败"));
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!orderId || !shouldPoll) return;
    timerRef.current = window.setInterval(() => {
      void refresh();
    }, 3000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [orderId, refresh, shouldPoll]);

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">支付结果</h1>
      <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-600">
        订单号：{orderId || "未提供"}
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-md border p-4">
        <div className="text-sm text-slate-500">当前状态</div>
        <div className="mt-1 text-lg font-semibold">
          {loading ? "加载中..." : statusText(data?.status)}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => void refresh()}
          disabled={loading}
        >
          我已完成支付，刷新状态
        </Button>
        <Button variant="secondary" onClick={() => router.push("/orders")}>
          返回订单页
        </Button>
      </div>
    </div>
  );
}
