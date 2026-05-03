import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import dayjs from 'dayjs';
import { OrderService } from '../order/order.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AlipayProvider } from './providers/alipay.provider';
import { WechatPayProvider } from './providers/wechat-pay.provider';
import { PaymentChannel } from '@prisma/client';

@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wechat: WechatPayProvider,
    private readonly alipay: AlipayProvider,
    private readonly orderService: OrderService,
  ) {}

  @Cron('0 */5 * * * *')
  async reconcilePending() {
    const candidates = await this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        outTradeNo: { not: null },
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
        if (r.status === 'PAID' && r.transactionId && r.paidAmountCents) {
          this.logger.warn(`[Reconcile] 发现漏单 ${o.orderNo}，执行补偿`);
          await this.orderService.markPaid({
            orderId: o.id,
            transactionId: r.transactionId,
            paidAmountCents: r.paidAmountCents,
            method: o.method,
            channel: o.channel,
            paidAt: r.paidAt ?? new Date(),
          });
        }
      } catch (e: unknown) {
        this.logger.error(
          `[Reconcile] 查询 ${o.orderNo} 失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
}
