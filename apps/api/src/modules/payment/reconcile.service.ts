import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import dayjs from 'dayjs';
import { OrderService } from '../order/order.service';
import { PaymentCallbackService } from './payment-callback.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AlipayProvider } from './providers/alipay.provider';
import { WechatPayProvider } from './providers/wechat-pay.provider';
import { OrderStatus, PaymentChannel } from '@prisma/client';

@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wechat: WechatPayProvider,
    private readonly alipay: AlipayProvider,
    private readonly orderService: OrderService,
    private readonly callbackService: PaymentCallbackService,
  ) {}

  @Cron('0 */5 * * * *')
  async reconcilePending() {
    const candidates = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT] },
        outTradeNo: { not: null },
        expiresAt: { gte: new Date() },
        createdAt: { gt: dayjs().subtract(2, 'hour').toDate() },
      },
      take: 50,
    });
    if (!candidates.length) return;
    this.logger.log(`[Reconcile] 巡检 PENDING 订单 ${candidates.length} 条`);

    for (const o of candidates) {
      try {
        if (!o.outTradeNo || !o.channel || !o.method) continue;
        const provider =
          o.channel === PaymentChannel.WECHAT ? this.wechat : this.alipay;
        const r = await provider.query(o.outTradeNo);
        const paidAt = r.paidAt ?? new Date();
        if (
          r.status === 'PAID' &&
          r.transactionId &&
          r.paidAmountCents &&
          paidAt.getTime() <=
            (o.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER)
        ) {
          this.logger.warn(`[Reconcile] 发现漏单 ${o.orderNo}，执行补偿`);
          await this.orderService.markPaid({
            orderId: o.id,
            transactionId: r.transactionId,
            paidAmountCents: r.paidAmountCents,
            method: o.method,
            channel: o.channel,
            paidAt,
          });
        }
      } catch (e: unknown) {
        this.logger.error(
          `[Reconcile] 查询 ${o.orderNo} 失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  async queryAndSettleByOrderId(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('订单不存在');
    const paymentRecordModel = (
      this.prisma as unknown as Record<string, unknown>
    )['paymentRecord'] as {
      findFirst: (args: {
        where: Record<string, unknown>;
        orderBy?: Record<string, unknown>;
      }) => Promise<Record<string, unknown> | null>;
      updateMany: (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => Promise<unknown>;
    };
    const record = await paymentRecordModel.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return { ok: false, reason: 'PAYMENT_RECORD_NOT_FOUND' };

    const pickString = (value: unknown): string | null => {
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return String(value);
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      return null;
    };

    const channel = (
      pickString(record['channel']) ??
      order.channel ??
      ''
    ).toUpperCase();
    const outTradeNo =
      pickString(record['providerOrderNo']) ??
      order.outTradeNo ??
      order.orderNo;
    let normalized: {
      success: boolean;
      providerTradeNo: string;
      amount: number;
      paidAt: Date;
      tradeStatus: string;
      raw: Record<string, unknown>;
      channel: 'wechat' | 'alipay' | 'mock';
      providerOrderNo: string;
    } | null = null;

    if (channel === 'WECHAT') {
      const r = await this.wechat.query(outTradeNo);
      if (r.status === 'PAID' && r.transactionId && r.paidAmountCents) {
        normalized = {
          channel: 'wechat',
          providerOrderNo: outTradeNo,
          providerTradeNo: r.transactionId,
          amount: r.paidAmountCents,
          paidAt: r.paidAt ?? new Date(),
          tradeStatus: 'SUCCESS',
          success: true,
          raw: { query: r },
        };
      }
    } else if (channel === 'ALIPAY') {
      const r = await this.alipay.query(outTradeNo);
      if (r.status === 'PAID' && r.transactionId && r.paidAmountCents) {
        normalized = {
          channel: 'alipay',
          providerOrderNo: outTradeNo,
          providerTradeNo: r.transactionId,
          amount: r.paidAmountCents,
          paidAt: r.paidAt ?? new Date(),
          tradeStatus: 'TRADE_SUCCESS',
          success: true,
          raw: { query: r },
        };
      }
    }

    if (normalized) {
      if (
        normalized.paidAt.getTime() >
        (order.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER)
      ) {
        return { ok: true, settled: false, reason: 'PAID_AFTER_EXPIRY' };
      }
      const settled = await this.callbackService.process(normalized);
      return { ok: true, settled };
    }

    if (
      (order.status === OrderStatus.PENDING ||
        order.status === OrderStatus.PENDING_PAYMENT) &&
      order.expiresAt < new Date()
    ) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CLOSED,
          cancelledAt: new Date(),
          remark: 'reconcile close expired',
        },
      });
      await paymentRecordModel.updateMany({
        where: { orderId: order.id, status: 'PENDING' },
        data: { status: 'CLOSED' },
      });
      return { ok: true, closed: true };
    }

    return { ok: true, settled: false };
  }

  async listAnomalies() {
    const paymentRecordModel = (
      this.prisma as unknown as Record<string, unknown>
    )['paymentRecord'] as {
      findMany: (
        args: Record<string, unknown>,
      ) => Promise<Record<string, unknown>[]>;
    };
    const items = await paymentRecordModel.findMany({
      where: { status: { in: ['SUCCEEDED', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return items.filter(
      (x) =>
        (String(x['status']) === 'SUCCEEDED' && !x['paidAt']) ||
        String(x['status']) === 'PENDING',
    );
  }
}
