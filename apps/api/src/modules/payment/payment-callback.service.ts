import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentChannel, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from '../order/order.service';

export type NormalizedPaymentResult = {
  channel: 'wechat' | 'alipay' | 'mock';
  providerOrderNo: string;
  providerTradeNo: string;
  amount: number;
  paidAt: Date;
  tradeStatus: string;
  success: boolean;
  raw: Record<string, unknown>;
  callbackLogId?: string;
};

@Injectable()
export class PaymentCallbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async process(result: NormalizedPaymentResult) {
    if (!result.success) return { processed: false, reason: 'NOT_SUCCESS' };
    const paymentRecordModel = (this.prisma as unknown as Record<string, unknown>)['paymentRecord'] as {
      findFirst: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
      findMany: (args: { where: Record<string, unknown> }) => Promise<Array<Record<string, unknown>>>;
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    };

    const payment = await paymentRecordModel.findFirst({ where: { providerOrderNo: result.providerOrderNo } });
    if (!payment) throw new NotFoundException('支付记录不存在');
    const order = await this.prisma.order.findUnique({ where: { id: String(payment['orderId']) } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.userId !== String(payment['userId'])) throw new BadRequestException('支付记录与订单用户不一致');
    if (order.amountCents !== result.amount) throw new BadRequestException('回调金额与订单金额不一致');

    const dup = await paymentRecordModel.findMany({ where: { providerTradeNo: result.providerTradeNo } });
    if (dup.some((x) => String(x['orderId']) !== order.id)) {
      throw new BadRequestException('providerTradeNo 已绑定其他订单');
    }

    if (String(payment['status']) === 'SUCCEEDED') return { processed: true, idempotent: true };

    await this.orderService.markPaid({
      orderId: order.id,
      transactionId: result.providerTradeNo,
      paidAmountCents: result.amount,
      method:
        result.channel === 'wechat'
          ? PaymentMethod.WECHAT_NATIVE
          : result.channel === 'alipay'
            ? PaymentMethod.ALIPAY_PAGE
            : PaymentMethod.WECHAT_NATIVE,
      channel:
        result.channel === 'wechat'
          ? PaymentChannel.WECHAT
          : result.channel === 'alipay'
            ? PaymentChannel.ALIPAY
            : PaymentChannel.WECHAT,
      paidAt: result.paidAt,
    });

    await paymentRecordModel.update({
      where: { id: String(payment['id']) },
      data: {
        status: 'SUCCEEDED',
        providerTradeNo: result.providerTradeNo,
        notifyRaw: result.raw as Prisma.InputJsonValue,
        notifyVerified: true,
        notifyReceivedAt: new Date(),
        paidAt: result.paidAt,
      },
    });

    return { processed: true, idempotent: false };
  }
}
