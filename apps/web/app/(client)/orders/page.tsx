"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ClientPageState } from "@/components/client/client-page-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clientHttp } from "@/lib/client/api-client";
import { getApiErrorMessage } from "@/lib/client/api-error";
import { clientAuth } from "@/lib/client/auth";
import { formatYuanFromFen } from "@/utils/format";
import { QRCodeCanvas } from "qrcode.react";
import {
  canShowMockPay,
  getDefaultWechatMethod,
  formatRemainingSeconds,
  isExpiredPaymentLikeStatus,
  isExpiredPaymentStatus,
  isPaidPaymentLikeStatus,
  isPaidPaymentStatus,
  isPendingPaymentLikeStatus,
  normalizePaymentStatus,
  readPaymentJumpUrl,
  readPaymentQrValue,
  safeClientRedirectUrl,
  type ClientPaymentStatus,
  type PaymentChannel,
  type PaymentMethod,
} from "@/components/client/payment-ui";

type ApiOrder = {
  id: string;
  orderNo: string;
  status: string;
  orderStatus?: string;
  paymentStatus?: string;
  paid?: boolean;
  expired?: boolean;
  canPay?: boolean;
  expiredAt?: string;
  remainingSeconds?: number;
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
  if (!snapshot || typeof snapshot !== "object") return 0;
  const s = snapshot as Record<string, unknown>;
  const brain = Number(s["brainCellAmount"] ?? 0);
  if (Number.isFinite(brain) && brain > 0) return Math.trunc(brain);
  const fallback =
    Number(s["paperQuota"] ?? 0) +
    Number(s["polishQuota"] ?? 0) +
    Number(s["exportQuota"] ?? 0) +
    Number(s["aiChatQuota"] ?? 0);
  return Number.isFinite(fallback) && fallback > 0 ? Math.trunc(fallback) : 0;
}

function statusLabel(status: string): string {
  const normalized = normalizePaymentStatus(status);
  return (
    {
      PENDING: "待支付",
      PENDING_PAYMENT: "待支付",
      PAID: "已支付",
      SUCCEEDED: "已支付",
      FULFILLING: "履约中",
      COMPLETED: "已完成",
      CANCELLED: "已取消",
      REFUNDING: "退款中",
      REFUNDED: "已退款",
      CLOSED: "已过期",
      EXPIRED: "已过期",
    }[normalized] ?? status
  );
}

function getOrderRawStatus(order: ApiOrder): string {
  return normalizePaymentStatus(order.orderStatus || order.status);
}

function getOrderRemainingSeconds(order: ApiOrder, nowMs = Date.now()): number {
  const expires = Date.parse(order.expiredAt || order.expiresAt || "");
  if (Number.isFinite(expires)) {
    return Math.max(0, Math.floor((expires - nowMs) / 1000));
  }
  return Math.max(0, Math.floor(Number(order.remainingSeconds ?? 0)));
}

function getOrderPublicStatus(order: ApiOrder, nowMs = Date.now()): string {
  const raw = getOrderRawStatus(order);
  if (isExpiredPaymentLikeStatus(raw) || order.expired === true) return "EXPIRED";
  if (raw === "CANCELLED") return "CANCELLED";
  if (isPendingPaymentLikeStatus(raw)) {
    return getOrderRemainingSeconds(order, nowMs) <= 0 ? "EXPIRED" : "PENDING";
  }
  if (isPaidPaymentLikeStatus(raw)) return raw === "SUCCEEDED" ? "PAID" : raw;
  if (order.paid === true) return "PAID";
  return raw;
}

function isOrderPaid(order: ApiOrder): boolean {
  return isPaidPaymentLikeStatus(getOrderPublicStatus(order));
}

function isOrderExpired(order: ApiOrder, nowMs = Date.now()): boolean {
  return getOrderPublicStatus(order, nowMs) === "EXPIRED";
}

function canPayOrder(order: ApiOrder, nowMs = Date.now()): boolean {
  if (order.canPay === false) return false;
  return (
    !isOrderPaid(order) &&
    !isOrderExpired(order, nowMs) &&
    getOrderPublicStatus(order, nowMs) === "PENDING"
  );
}

function payButtonLabel(order: ApiOrder, nowMs = Date.now()): string {
  const status = getOrderPublicStatus(order, nowMs);
  if (status === "PENDING") return "去支付";
  if (status === "EXPIRED") return "已过期";
  if (status === "CANCELLED") return "已取消";
  if (isPaidPaymentLikeStatus(status)) return "已完成";
  return statusLabel(status);
}


export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brainCellBalance, setBrainCellBalance] = useState<number>(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const expiredRefreshRef = useRef(false);

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payOrderId, setPayOrderId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payQrValue, setPayQrValue] = useState<string | null>(null);
  const [payStatus, setPayStatus] = useState<string | null>(null);
  const [payHint, setPayHint] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const pollStartedAtRef = useRef<number>(0);
  const autoPrepayKeyRef = useRef<string | null>(null);
  const redirectTimerRef = useRef<number | null>(null);
  const mockPayEnabled = canShowMockPay({
    role: clientAuth.getUser()?.role,
    enableMockPay: process.env.NEXT_PUBLIC_ENABLE_MOCK_PAY,
  });

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const list = await clientHttp.get<ApiOrderListResp>("/orders", {
        page: 1,
        pageSize: 50,
      });
      const quota = await clientHttp.get<Record<string, number>>("/quota/me");
      setOrders(Array.isArray(list.items) ? list.items : []);
      setTotal(typeof list.total === "number" ? list.total : 0);
      setBrainCellBalance(Number(quota?.["BRAIN_CELL"] ?? 0) || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const hasLocallyExpiredPending = orders.some(
      (order) =>
        getOrderPublicStatus(order, nowMs) === "EXPIRED" &&
        !order.expired &&
        !isOrderPaid(order),
    );
    if (!hasLocallyExpiredPending || expiredRefreshRef.current) return;
    expiredRefreshRef.current = true;
    void refreshAll().finally(() => {
      expiredRefreshRef.current = false;
    });
  }, [orders, nowMs]);

  useEffect(() => {
    if (!payDialogOpen) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
      autoPrepayKeyRef.current = null;
      setPayHint(null);
    }
  }, [payDialogOpen]);

  const currentOrder = useMemo(() => {
    if (!payOrderId) return null;
    return orders.find((o) => o.id === payOrderId) ?? null;
  }, [orders, payOrderId]);

  const currentRemainingSeconds = currentOrder
    ? getOrderRemainingSeconds(currentOrder, nowMs)
    : 0;
  const currentOrderCanPay = currentOrder
    ? canPayOrder(currentOrder, nowMs)
    : false;

  const handlePaidSuccess = async (status: ClientPaymentStatus) => {
    const brainCells = currentOrder
      ? calcBrainCellsFromSnapshot(currentOrder.productSnapshot)
      : 0;
    if (brainCells > 0) {
      toast.success(`支付成功并获得脑细胞 ${brainCells} 颗`);
    } else {
      toast.success("支付成功");
    }
    setPayStatus(
      status.orderStatus ?? status.paymentStatus ?? status.status ?? "PAID",
    );
    const redirectUrl = safeClientRedirectUrl(status);
    await refreshAll();
    redirectTimerRef.current = window.setTimeout(() => {
      setPayDialogOpen(false);
      router.replace(redirectUrl);
    }, 800);
  };

  const queryPaymentStatusOnce = async (orderId: string) => {
    return clientHttp.get<ClientPaymentStatus>(
      `/orders/${orderId}/payment-status`,
    );
  };

  const refreshPaymentStatusOnce = async (orderId: string) => {
    return clientHttp.post<ClientPaymentStatus>(
      `/orders/${orderId}/payment-status/refresh`,
      {},
    );
  };

  const startPolling = (orderId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollStartedAtRef.current = Date.now();
    pollRef.current = window.setInterval(async () => {
      if (Date.now() - pollStartedAtRef.current > 180_000) {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setPayHint("支付状态查询超时，请点击刷新订单或稍后重试。");
        return;
      }
      try {
        const s = await queryPaymentStatusOnce(orderId);
        setPayStatus(s.orderStatus ?? s.paymentStatus ?? s.status ?? null);
        if (isPaidPaymentStatus(s)) {
          if (pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
          await handlePaidSuccess(s);
          return;
        }
        if (isExpiredPaymentStatus(s)) {
          if (pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setPayStatus("EXPIRED");
          setPayHint(s.message || "订单已过期，请重新下单。");
          await refreshAll();
        }
      } catch (e: unknown) {
        const msg = getApiErrorMessage(e, "暂未查询到支付结果，请稍后再试");
        setPayHint(msg);
        return;
      }
    }, 2000);
  };

  const beginPrepay = async (opts: {
    orderId: string;
    channel: PaymentChannel;
    method?: PaymentMethod;
  }) => {
    try {
      const order = orders.find((item) => item.id === opts.orderId);
      if (order && !canPayOrder(order, Date.now())) {
        setPayStatus("EXPIRED");
        setPayHint("订单已过期，请重新下单。");
        await refreshPaymentStatusOnce(opts.orderId).catch(() => null);
        await refreshAll();
        return;
      }
      setPaying(true);
      setPayQrValue(null);
      setPayStatus("PENDING");
      setPayHint(null);

      const res = await clientHttp.post<Record<string, unknown>>(
        "/payment/prepay",
        {
          orderId: opts.orderId,
          channel: opts.channel,
          method:
            opts.method ??
            (opts.channel === "WECHAT"
              ? getDefaultWechatMethod(window.navigator.userAgent)
              : "ALIPAY_PAGE"),
        },
      );

      const paymentStatus = res as unknown as ClientPaymentStatus;
      if (isPaidPaymentStatus(paymentStatus)) {
        setPayHint('已检测到支付成功，正在跳转...');
        await handlePaidSuccess(paymentStatus);
        return;
      }
      if (paymentStatus.paid === false && typeof paymentStatus.message === 'string') {
        setPayHint(paymentStatus.message);
        return;
      }

      const qr = readPaymentQrValue(res);
      const jumpUrl = readPaymentJumpUrl(res);
      startPolling(opts.orderId);

      if (qr) {
        setPayQrValue(qr);
        return;
      }
      if (jumpUrl) {
        setPayHint("正在跳转微信 H5 支付，请完成支付后返回本页查看结果。");
        window.location.href = jumpUrl;
        return;
      }
      throw new Error("未获取到支付二维码或跳转链接");
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, "发起支付失败");
      toast.error(msg);
      setPayHint(msg);
      if (msg.includes("ORDERPAID") || msg.includes("已支付")) {
        try {
          const s = await refreshPaymentStatusOnce(opts.orderId);
          if (isPaidPaymentStatus(s)) {
            if (pollRef.current) {
              window.clearInterval(pollRef.current);
              pollRef.current = null;
            }
            await handlePaidSuccess(s);
            return;
          }
          await refreshAll();
        } catch {
          return;
        }
      }
      setPayQrValue(null);
      setPayStatus(null);
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    if (!payDialogOpen || !payOrderId) return;
    const key = `${payOrderId}:wechat-default`;
    if (autoPrepayKeyRef.current === key) return;
    autoPrepayKeyRef.current = key;
    void beginPrepay({ orderId: payOrderId, channel: "WECHAT" });
    // beginPrepay intentionally stays outside dependencies to avoid recreating the default prepay flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payDialogOpen, payOrderId]);

  const simulatePaid = async (orderId: string) => {
    try {
      const order = orders.find((item) => item.id === orderId);
      if (order && !canPayOrder(order, Date.now())) {
        setPayStatus("EXPIRED");
        setPayHint("订单已过期，请重新下单。");
        await refreshPaymentStatusOnce(orderId).catch(() => null);
        await refreshAll();
        return;
      }
      setPaying(true);
      await clientHttp.post("/payment/sandbox/simulate-paid", { orderId });
      const status = await queryPaymentStatusOnce(orderId);
      await handlePaidSuccess(status);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "支付失败"));
    } finally {
      setPaying(false);
    }
  };

  const state = loading
    ? "loading"
    : error
      ? "error"
      : orders.length === 0
        ? "empty"
        : "success";

  const paidBrainCells = useMemo(() => {
    return orders
      .filter((o) => isOrderPaid(o))
      .reduce(
        (sum, o) => sum + calcBrainCellsFromSnapshot(o.productSnapshot),
        0,
      );
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
              当前脑细胞余额：{brainCellBalance}；累计已获（本页统计）：
              {paidBrainCells}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => void refreshAll()}
            disabled={loading}
          >
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
            const publicStatus = getOrderPublicStatus(o, nowMs);
            const canPay = canPayOrder(o, nowMs);
            const remainingSeconds = getOrderRemainingSeconds(o, nowMs);
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
                      <div className="font-semibold text-slate-900">
                        {o.product.name}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {statusLabel(publicStatus)}
                      </span>
                      {brainCells ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          脑细胞 +{brainCells}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      订单号 {o.orderNo} · 下单{" "}
                      {new Date(o.createdAt).toLocaleString()}
                    </div>
                    {publicStatus === "PENDING" ? (
                      <div className="mt-1 text-xs text-amber-700">
                        请在 10 分钟内完成支付，剩余{" "}
                        {formatRemainingSeconds(remainingSeconds)}
                      </div>
                    ) : publicStatus === "EXPIRED" ? (
                      <div className="mt-1 text-xs text-rose-600">
                        订单已过期，请重新下单
                      </div>
                    ) : null}
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
                      setPayOrderId(o.id);
                      setPayQrValue(null);
                      setPayStatus(null);
                      setPayDialogOpen(true);
                    }}
                    disabled={!canPay}
                  >
                    {payButtonLabel(o, nowMs)}
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

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>订单支付</DialogTitle>
            <DialogDescription>
              {currentOrder
                ? `订单号 ${currentOrder.orderNo} · 金额 ${formatYuanFromFen(currentOrder.amountCents)} · 请在 10 分钟内完成支付，剩余 ${formatRemainingSeconds(currentRemainingSeconds)}`
                : "请选择支付方式完成支付"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  if (!payOrderId) return;
                  void beginPrepay({ orderId: payOrderId, channel: "ALIPAY" });
                }}
                disabled={!payOrderId || paying || !currentOrderCanPay}
              >
                切换支付宝支付
              </Button>
              {mockPayEnabled ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!payOrderId) return;
                    void simulatePaid(payOrderId);
                  }}
                  disabled={!payOrderId || paying || !currentOrderCanPay}
                >
                  沙箱一键支付
                </Button>
              ) : null}
            </div>

            {payQrValue ? (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[240px_1fr]">
                <div className="flex items-center justify-center">
                  <div className="rounded-lg border border-slate-200 bg-white p-2">
                    <QRCodeCanvas value={payQrValue} size={220} />
                  </div>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="font-medium text-slate-900">
                    请使用微信/支付宝扫一扫
                  </div>
                  <div className="text-slate-600">
                    支付状态：{payStatus ? statusLabel(payStatus) : "—"}；剩余{" "}
                    {formatRemainingSeconds(currentRemainingSeconds)}
                  </div>
                  <div className="break-all rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                    {payQrValue}
                  </div>
                  <div className="text-xs text-slate-500">
                    该弹框每 2 秒轮询后端订单状态；支付成功后 0.8 秒自动跳转。
                  </div>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      if (!payOrderId) return;
                      try {
                        const s = await refreshPaymentStatusOnce(payOrderId);
                        setPayStatus(
                          s.orderStatus ?? s.paymentStatus ?? s.status ?? null,
                        );
                        if (isPaidPaymentStatus(s)) {
                          if (pollRef.current) {
                            window.clearInterval(pollRef.current);
                            pollRef.current = null;
                          }
                          await handlePaidSuccess(s);
                          return;
                        }
                        if (isExpiredPaymentStatus(s)) {
                          if (pollRef.current) {
                            window.clearInterval(pollRef.current);
                            pollRef.current = null;
                          }
                          setPayStatus("EXPIRED");
                          setPayHint(s.message || "订单已过期，请重新下单。");
                          await refreshAll();
                          return;
                        }
                        setPayHint(
                          "尚未检测到支付成功，如已支付请稍后再点一次。",
                        );
                      } catch (e: unknown) {
                        setPayHint(
                          getApiErrorMessage(e, "暂未查询到支付结果，请稍后再试"),
                        );
                      }
                    }}
                    disabled={
                      !payOrderId ||
                      (!currentOrderCanPay && payStatus !== "EXPIRED")
                    }
                  >
                    我已完成支付
                  </Button>
                  {payHint ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      {payHint}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {currentOrderCanPay
                  ? paying
                    ? "正在发起微信支付..."
                    : `已默认发起微信支付；请在 10 分钟内完成支付，剩余 ${formatRemainingSeconds(currentRemainingSeconds)}。`
                  : "订单已过期，请重新下单。"}
                {payHint ? (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    {payHint}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => void refreshAll()}
              disabled={loading}
            >
              刷新订单
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setPayDialogOpen(false);
                router.push("/account");
              }}
            >
              去个人中心
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientPageState>
  );
}
