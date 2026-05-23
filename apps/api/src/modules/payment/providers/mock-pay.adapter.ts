import { Injectable } from '@nestjs/common';
import {
  CreatePaymentContext,
  PaymentMethodCode,
  PaymentProviderAdapter,
  ProviderOrderLike,
  ProviderPaymentRecordLike,
} from './payment-provider.interface';

@Injectable()
export class MockPayAdapter implements PaymentProviderAdapter {
  getChannel() {
    return 'mock' as const;
  }

  createPayment(
    order: ProviderOrderLike,
    method: PaymentMethodCode,
    context: CreatePaymentContext,
  ) {
    return Promise.resolve({
      channel: 'mock',
      method,
      orderNo: order.orderNo,
      paymentUrl: `mock://pay/${order.orderNo}`,
      clientIp: context.clientIp,
      status: 'PENDING',
    });
  }

  handleCallback() {
    return Promise.resolve({ channel: 'mock', status: 'SUCCEEDED' });
  }

  queryPayment(paymentRecord: ProviderPaymentRecordLike) {
    return Promise.resolve({
      channel: 'mock',
      paymentNo: paymentRecord.paymentNo,
      status: 'PENDING',
    });
  }

  closePayment(paymentRecord: ProviderPaymentRecordLike) {
    return Promise.resolve({
      channel: 'mock',
      paymentNo: paymentRecord.paymentNo,
      status: 'CLOSED',
    });
  }
}
