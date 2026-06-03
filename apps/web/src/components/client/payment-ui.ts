export type PaymentChannel = "WECHAT" | "ALIPAY";
export type PaymentMethod =
  | "WECHAT_NATIVE"
  | "WECHAT_H5"
  | "ALIPAY_PAGE"
  | "ALIPAY_WAP";

export type ClientPaymentStatus = {
  orderId: string;
  orderNo?: string;
  orderStatus?: string;
  paymentStatus?: string;
  status?: string;
  paid?: boolean;
  expired?: boolean;
  canPay?: boolean;
  expiredAt?: string | null;
  expiresAt?: string | null;
  remainingSeconds?: number;
  message?: string;
  paidAt?: string | null;
  taskId?: string | null;
  redirectUrl?: string | null;
  brainCellBalance?: number;
};


export function normalizePaymentStatus(status?: string | null): string {
  return String(status ?? "").trim().toUpperCase();
}

export function isPendingPaymentLikeStatus(status?: string | null): boolean {
  const normalized = normalizePaymentStatus(status);
  return normalized === "PENDING" || normalized === "PENDING_PAYMENT";
}

export function isPaidPaymentLikeStatus(status?: string | null): boolean {
  const normalized = normalizePaymentStatus(status);
  return (
    normalized === "PAID" ||
    normalized === "SUCCEEDED" ||
    normalized === "FULFILLING" ||
    normalized === "COMPLETED"
  );
}

export function isExpiredPaymentLikeStatus(status?: string | null): boolean {
  const normalized = normalizePaymentStatus(status);
  return normalized === "EXPIRED" || normalized === "CLOSED";
}

export function isAdminRole(role?: string | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canShowMockPay(args: {
  role?: string | null;
  enableMockPay?: string | boolean | null;
}): boolean {
  const enabled =
    args.enableMockPay === true ||
    String(args.enableMockPay ?? "").toLowerCase() === "true";
  return enabled && isAdminRole(args.role);
}

export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(userAgent);
}

export function getDefaultWechatMethod(userAgent: string): PaymentMethod {
  return isMobileUserAgent(userAgent) ? "WECHAT_H5" : "WECHAT_NATIVE";
}

export function readPaymentQrValue(
  payload: Record<string, unknown>,
): string | null {
  const candidates = [payload.qrCodeUrl, payload.codeUrl, payload.code_url];
  const qr = candidates.find((v) => typeof v === "string" && v.trim());
  return typeof qr === "string" ? qr : null;
}

export function readPaymentJumpUrl(
  payload: Record<string, unknown>,
): string | null {
  const candidates = [
    payload.payUrl,
    payload.paymentUrl,
    payload.mwebUrl,
    payload.mweb_url,
  ];
  const url = candidates.find((v) => typeof v === "string" && v.trim());
  return typeof url === "string" ? url : null;
}

export function isPaidPaymentStatus(status: ClientPaymentStatus): boolean {
  return (
    status.paid === true ||
    isPaidPaymentLikeStatus(status.paymentStatus) ||
    isPaidPaymentLikeStatus(status.orderStatus) ||
    isPaidPaymentLikeStatus(status.status)
  );
}

export function safeClientRedirectUrl(
  status: Pick<ClientPaymentStatus, "redirectUrl" | "taskId">,
): string {
  const redirectUrl =
    typeof status.redirectUrl === "string" ? status.redirectUrl.trim() : "";
  if (redirectUrl.startsWith("/") && !redirectUrl.startsWith("//"))
    return redirectUrl;
  if (status.taskId)
    return `/tasks?taskId=${encodeURIComponent(status.taskId)}`;
  return "/account";
}

export function isExpiredPaymentStatus(status: ClientPaymentStatus): boolean {
  return (
    status.expired === true ||
    isExpiredPaymentLikeStatus(status.orderStatus) ||
    isExpiredPaymentLikeStatus(status.paymentStatus) ||
    isExpiredPaymentLikeStatus(status.status) ||
    (typeof status.remainingSeconds === "number" &&
      status.remainingSeconds <= 0 &&
      status.paid !== true)
  );
}

export function formatRemainingSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
