export type PaymentChannel = 'WECHAT' | 'ALIPAY';
export type PaymentMethod = 'WECHAT_NATIVE' | 'WECHAT_H5' | 'ALIPAY_PAGE' | 'ALIPAY_WAP';

export type ClientPaymentStatus = {
  orderId: string;
  orderNo?: string;
  orderStatus?: string;
  paymentStatus?: string;
  status?: string;
  paid?: boolean;
  paidAt?: string | null;
  taskId?: string | null;
  redirectUrl?: string | null;
  brainCellBalance?: number;
};

export function isAdminRole(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function canShowMockPay(args: {
  role?: string | null;
  enableMockPay?: string | boolean | null;
}): boolean {
  const enabled =
    args.enableMockPay === true || String(args.enableMockPay ?? '').toLowerCase() === 'true';
  return enabled && isAdminRole(args.role);
}

export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(userAgent);
}

export function getDefaultWechatMethod(userAgent: string): PaymentMethod {
  return isMobileUserAgent(userAgent) ? 'WECHAT_H5' : 'WECHAT_NATIVE';
}

export function readPaymentQrValue(payload: Record<string, unknown>): string | null {
  const candidates = [payload.qrCodeUrl, payload.codeUrl, payload.code_url];
  const qr = candidates.find((v) => typeof v === 'string' && v.trim());
  return typeof qr === 'string' ? qr : null;
}

export function readPaymentJumpUrl(payload: Record<string, unknown>): string | null {
  const candidates = [payload.payUrl, payload.paymentUrl, payload.mwebUrl, payload.mweb_url];
  const url = candidates.find((v) => typeof v === 'string' && v.trim());
  return typeof url === 'string' ? url : null;
}

export function isPaidPaymentStatus(status: ClientPaymentStatus): boolean {
  return (
    status.paid === true ||
    status.paymentStatus === 'PAID' ||
    status.orderStatus === 'PAID' ||
    status.orderStatus === 'FULFILLING' ||
    status.orderStatus === 'COMPLETED' ||
    status.status === 'PAID' ||
    status.status === 'COMPLETED'
  );
}

export function safeClientRedirectUrl(status: Pick<ClientPaymentStatus, 'redirectUrl' | 'taskId'>): string {
  const redirectUrl = typeof status.redirectUrl === 'string' ? status.redirectUrl.trim() : '';
  if (redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) return redirectUrl;
  if (status.taskId) return `/tasks?taskId=${encodeURIComponent(status.taskId)}`;
  return '/account';
}
