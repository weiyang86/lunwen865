export type PaymentChannelCode = 'mock' | 'wechat' | 'alipay';
export type PaymentMethodCode = 'mock' | 'native' | 'h5' | 'page' | 'wap';

export interface CreatePaymentContext {
  clientIp: string;
  userId: string;
}

export interface ProviderOrderLike {
  id: string;
  orderNo: string;
  amountCents: number;
}

export interface ProviderPaymentRecordLike {
  id: string;
  paymentNo: string;
  amountCents: number;
}

export interface PaymentProviderAdapter {
  getChannel(): PaymentChannelCode;
  createPayment(
    order: ProviderOrderLike,
    method: PaymentMethodCode,
    context: CreatePaymentContext,
  ): Promise<Record<string, unknown>>;
  handleCallback(
    rawBody: string,
    headers: Record<string, string>,
    query: Record<string, string>,
  ): Promise<Record<string, unknown>>;
  queryPayment(
    paymentRecord: ProviderPaymentRecordLike,
  ): Promise<Record<string, unknown>>;
  closePayment(
    paymentRecord: ProviderPaymentRecordLike,
  ): Promise<Record<string, unknown>>;
}
