import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentChannel,
  PaymentLogType,
  PaymentMethod,
  Prisma,
  QuotaChangeReason,
  QuotaType,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { QuotaService } from '../quota/quota.service';
import { PrepayDto } from './dto/prepay.dto';
import { RefundDto } from './dto/refund.dto';
import { AlipayProvider } from './providers/alipay.provider';
import { WechatPayProvider } from './providers/wechat-pay.provider';
import { generateRefundNo } from '../order/utils/order-no.util';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly quotaService: QuotaService,
    private readonly config: ConfigService,
    private readonly wechat: WechatPayProvider,
    private readonly alipay: AlipayProvider,
  ) {}

  private isSandbox(): boolean {
    return this.config.get<boolean>('payment.sandbox', true) === true;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
  }

  private centsToYuanString(cents: number): string {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    const yuan = Math.floor(abs / 100);
    const fen = abs % 100;
    return `${sign}${yuan}.${String(fen).padStart(2, '0')}`;
  }

  private yuanStringToCents(amount: string): number {
    const raw = String(amount ?? '').trim();
    if (!raw) return 0;
    const neg = raw.startsWith('-');
    const s = neg ? raw.slice(1) : raw;
    const [yuanRaw, fenRaw = ''] = s.split('.');
    const yuan = Number.parseInt(yuanRaw || '0', 10);
    if (!Number.isFinite(yuan)) return 0;
    const fen2 = (fenRaw + '00').slice(0, 2);
    const fen = Number.parseInt(fen2 || '0', 10);
    if (!Number.isFinite(fen)) return 0;
    const cents = yuan * 100 + fen;
    return neg ? -cents : cents;
  }

  private extractRefundId(response: unknown): string | null {
    if (!this.isRecord(response)) return null;
    const id = response['refundId'] ?? response['refund_id'];
    return typeof id === 'string' ? id : null;
  }

  async prepay(userId: string, dto: PrepayDto, clientIp: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { product: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.userId !== userId) throw new ForbiddenException('无权访问该订单');
    if (order.status !== OrderStatus.PENDING)
      throw new BadRequestException('订单当前状态不可支付');
    if (order.expiresAt.getTime() < Date.now())
      throw new BadRequestException('订单已过期');

    if (dto.channel === PaymentChannel.WECHAT) {
      if (!String(dto.method).startsWith('WECHAT_')) {
        throw new BadRequestException('支付方式与通道不匹配');
      }
    }
    if (dto.channel === PaymentChannel.ALIPAY) {
      if (!String(dto.method).startsWith('ALIPAY_')) {
        throw new BadRequestException('支付方式与通道不匹配');
      }
    }

    const outTradeNo = order.outTradeNo ?? order.orderNo;
    if (
      !order.outTradeNo ||
      order.channel !== dto.channel ||
      order.method !== dto.method
    ) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          outTradeNo,
          channel: dto.channel,
          method: dto.method,
        },
      });
    }

    const notifyUrl =
      dto.channel === PaymentChannel.WECHAT
        ? this.config.get<string>('payment.wechat.notifyUrl', '')
        : this.config.get<string>('payment.alipay.notifyUrl', '');

    if (!notifyUrl && !this.isSandbox()) {
      throw new BadRequestException('缺少支付回调地址配置');
    }

    let response: unknown;
    if (dto.channel === PaymentChannel.WECHAT) {
      if (dto.method !== PaymentMethod.WECHAT_NATIVE) {
        throw new BadRequestException('暂仅支持 WECHAT_NATIVE');
      }
      response = await this.wechat.nativePrepay({
        outTradeNo,
        description: order.product.name,
        amountCents: order.amountCents,
        clientIp,
        notifyUrl,
      });
    } else if (dto.channel === PaymentChannel.ALIPAY) {
      if (dto.method !== PaymentMethod.ALIPAY_PAGE) {
        throw new BadRequestException('暂仅支持 ALIPAY_PAGE');
      }
      response = await this.alipay.pagePay({
        outTradeNo,
        subject: order.product.name,
        totalAmountCents: order.amountCents,
        notifyUrl,
        returnUrl: this.config.get<string>('payment.alipay.returnUrl', ''),
      });
    } else {
      throw new BadRequestException('不支持的支付通道');
    }

    await this.prisma.paymentLog.create({
      data: {
        orderId: order.id,
        type: PaymentLogType.PREPAY,
        channel: dto.channel,
        success: true,
        request: { dto, clientIp } as unknown as Prisma.InputJsonValue,
        response: response as Prisma.InputJsonValue,
      },
    });

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      outTradeNo,
      channel: dto.channel,
      method: dto.method,
      ...((response ?? {}) as Record<string, unknown>),
    };
  }

  async simulatePaid(
    userId: string,
    orderId: string,
    options: { channel: PaymentChannel; method: PaymentMethod },
  ) {
    if (!this.isSandbox()) {
      throw new ForbiddenException('该接口仅在沙箱模式可用');
    }
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.userId !== userId) throw new ForbiddenException('无权访问该订单');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('订单当前状态不可支付');
    }
    const outTradeNo = order.outTradeNo ?? order.orderNo;
    if (
      !order.outTradeNo ||
      order.channel !== options.channel ||
      order.method !== options.method
    ) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          outTradeNo,
          channel: options.channel,
          method: options.method,
        },
      });
    }
    if (options.channel === PaymentChannel.WECHAT) {
      return this.handleWechatPayNotify({
        headers: {},
        rawBody: '{}',
        body: {
          outTradeNo,
          transactionId: `SIM_${Date.now()}`,
          paidAmountCents: order.amountCents,
          paidAt: new Date().toISOString(),
        },
      });
    }
    return this.handleAlipayPayNotify({
      out_trade_no: outTradeNo,
      trade_no: `SIM_${Date.now()}`,
      total_amount: this.centsToYuanString(order.amountCents),
      gmt_payment: new Date().toISOString(),
    });
  }

  async handleWechatPayNotify(params: {
    headers: Record<string, string>;
    rawBody: string;
    body: unknown;
  }) {
    const parsed = this.isSandbox()
      ? this.parseWechatSandboxNotify(params.body)
      : this.wechat.verifyAndParsePayNotify(params.headers, params.rawBody);

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ outTradeNo: parsed.outTradeNo }, { orderNo: parsed.outTradeNo }],
      },
    });
    if (!order) throw new NotFoundException('订单不存在');

    await this.prisma.paymentLog.create({
      data: {
        orderId: order.id,
        type: PaymentLogType.NOTIFY,
        channel: PaymentChannel.WECHAT,
        success: true,
        request: {
          headers: params.headers,
          body: params.body,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    const res = await this.orderService.markPaid({
      orderId: order.id,
      transactionId: parsed.transactionId,
      paidAmountCents: parsed.paidAmountCents,
      method: PaymentMethod.WECHAT_NATIVE,
      channel: PaymentChannel.WECHAT,
      paidAt: parsed.paidAt,
    });

    return res;
  }

  async handleAlipayPayNotify(payload: Record<string, string>) {
    const parsed = this.isSandbox()
      ? this.parseAlipaySandboxNotify(payload)
      : this.alipay.verifyAndParsePayNotify(payload);

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ outTradeNo: parsed.outTradeNo }, { orderNo: parsed.outTradeNo }],
      },
    });
    if (!order) throw new NotFoundException('订单不存在');

    await this.prisma.paymentLog.create({
      data: {
        orderId: order.id,
        type: PaymentLogType.NOTIFY,
        channel: PaymentChannel.ALIPAY,
        success: true,
        request: payload,
      },
    });

    const res = await this.orderService.markPaid({
      orderId: order.id,
      transactionId: parsed.tradeNo,
      paidAmountCents: parsed.paidAmountCents,
      method: PaymentMethod.ALIPAY_PAGE,
      channel: PaymentChannel.ALIPAY,
      paidAt: parsed.paidAt,
    });

    return res;
  }

  async createRefund(params: {
    operatorId: string;
    orderId: string;
    amountCents?: number;
    reason: string;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: params.orderId },
      include: { refunds: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(`订单状态 ${order.status}，无法退款`);
    }

    const alreadyRefunded = order.refunds
      .filter((r) => r.status === RefundStatus.SUCCESS)
      .reduce((sum, r) => sum + r.amountCents, 0);
    const orderTotal = order.paidAmountCents ?? order.amountCents;
    const maxRefundable = orderTotal - alreadyRefunded;
    const amount = params.amountCents ?? maxRefundable;
    if (amount <= 0 || amount > maxRefundable) {
      throw new BadRequestException(
        `退款金额必须在 1 - ${maxRefundable} 分之间`,
      );
    }

    const refundNo = generateRefundNo();
    const outRefundNo = generateRefundNo();
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.REFUNDING },
      });
      return tx.refund.create({
        data: {
          refundNo,
          orderId: order.id,
          amountCents: amount,
          reason: params.reason,
          operatorId: params.operatorId,
          outRefundNo,
          status: RefundStatus.PENDING,
        },
      });
    });

    let response: unknown;
    try {
      if (order.channel === PaymentChannel.WECHAT) {
        response = await this.wechat.refund({
          outTradeNo: order.outTradeNo ?? order.orderNo,
          transactionId: order.transactionId ?? undefined,
          outRefundNo,
          reason: params.reason,
          refundAmountCents: amount,
          totalAmountCents: orderTotal,
          notifyUrl: this.config.get<string>('payment.wechat.notifyUrl', ''),
        });
      } else if (order.channel === PaymentChannel.ALIPAY) {
        response = await this.alipay.refund({
          outTradeNo: order.outTradeNo ?? order.orderNo,
          outRefundNo,
          refundAmountCents: amount,
          reason: params.reason,
        });
      } else if (this.isSandbox()) {
        response = { refundId: `SIM_REFUND_${Date.now()}` };
      } else {
        throw new BadRequestException('订单缺少支付通道信息');
      }

      await this.prisma.paymentLog.create({
        data: {
          orderId: order.id,
          type: PaymentLogType.REFUND_APPLY,
          channel: order.channel ?? null,
          request: { refundId: created.id, amount },
          response: response ?? {},
          success: true,
        },
      });

      if (this.isSandbox()) {
        await this.markRefundSuccess(
          created.id,
          this.extractRefundId(response) ?? undefined,
        );
      }
    } catch (error: unknown) {
      await this.prisma.paymentLog.create({
        data: {
          orderId: order.id,
          type: PaymentLogType.REFUND_APPLY,
          channel: order.channel ?? null,
          request: { refundId: created.id, amount },
          success: false,
          message: error instanceof Error ? error.message : '未知错误',
        },
      });
      await this.markRefundFailed(
        created.id,
        error instanceof Error ? error.message : '未知错误',
      );
      throw error;
    }

    const latest = await this.prisma.refund.findUnique({
      where: { id: created.id },
    });
    return latest ?? created;
  }

  async applyRefund(operatorId: string, dto: RefundDto) {
    return this.createRefund({
      operatorId,
      orderId: dto.orderId,
      amountCents: dto.amountCents,
      reason: dto.reason,
    });
  }

  async handleWechatRefundNotify(params: {
    headers: Record<string, string>;
    rawBody: string;
    body: unknown;
  }) {
    const outRefundNo = this.isSandbox()
      ? this.parseWechatSandboxRefundNotify(params.body)
      : this.parseWechatRefundNotify(params.headers, params.rawBody);

    const refund = await this.prisma.refund.findFirst({
      where: { outRefundNo },
    });
    if (!refund) throw new NotFoundException('退款单不存在');

    await this.prisma.paymentLog.create({
      data: {
        orderId: refund.orderId,
        type: PaymentLogType.REFUND_NOTIFY,
        channel: PaymentChannel.WECHAT,
        success: true,
        request: {
          headers: params.headers,
          body: params.body,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await this.markRefundSuccess({
      refundId: refund.id,
      providerRefundId: null,
    });

    return refund;
  }

  async handleAlipayRefundNotify(payload: Record<string, string>) {
    const outRefundNo = this.isSandbox()
      ? this.parseAlipaySandboxRefundNotify(payload)
      : this.parseAlipayRefundNotify(payload);

    const refund = await this.prisma.refund.findFirst({
      where: { outRefundNo },
    });
    if (!refund) throw new NotFoundException('退款单不存在');

    await this.prisma.paymentLog.create({
      data: {
        orderId: refund.orderId,
        type: PaymentLogType.REFUND_NOTIFY,
        channel: PaymentChannel.ALIPAY,
        success: true,
        request: payload,
      },
    });

    await this.markRefundSuccess({
      refundId: refund.id,
      providerRefundId: null,
    });

    return refund;
  }

  private parseWechatSandboxNotify(body: unknown) {
    if (!this.isRecord(body)) throw new BadRequestException('回调体格式错误');
    const outTradeNoRaw = body['outTradeNo'] ?? body['out_trade_no'];
    if (typeof outTradeNoRaw !== 'string' || !outTradeNoRaw) {
      throw new BadRequestException('缺少 outTradeNo');
    }
    const transactionIdRaw =
      body['transactionId'] ?? body['transaction_id'] ?? `TEST_${Date.now()}`;
    const transactionId =
      typeof transactionIdRaw === 'string'
        ? transactionIdRaw
        : `TEST_${Date.now()}`;
    const paidAmountRaw = body['paidAmountCents'] ?? body['amount'] ?? 0;
    const paidAmountCents =
      typeof paidAmountRaw === 'number'
        ? paidAmountRaw
        : Number(typeof paidAmountRaw === 'string' ? paidAmountRaw : 0);
    const paidAtRaw = body['paidAt'];
    const paidAt =
      typeof paidAtRaw === 'string' && paidAtRaw
        ? new Date(paidAtRaw)
        : new Date();
    const outTradeNo = outTradeNoRaw;
    return { outTradeNo, transactionId, paidAmountCents, paidAt };
  }

  private parseAlipaySandboxNotify(payload: Record<string, string>) {
    const outTradeNo = String(
      payload['out_trade_no'] ?? payload['outTradeNo'] ?? '',
    );
    const tradeNo = String(
      payload['trade_no'] ?? payload['tradeNo'] ?? `TEST_${Date.now()}`,
    );
    const paidAmountCents = payload['total_amount']
      ? this.yuanStringToCents(String(payload['total_amount']))
      : Number(payload['paidAmountCents'] ?? 0);
    const paidAt = payload['gmt_payment']
      ? new Date(payload['gmt_payment'])
      : new Date();
    if (!outTradeNo) throw new BadRequestException('缺少 out_trade_no');
    return { outTradeNo, tradeNo, paidAmountCents, paidAt };
  }

  private parseWechatSandboxRefundNotify(body: unknown): string {
    if (!this.isRecord(body)) throw new BadRequestException('回调体格式错误');
    const outRefundNoRaw = body['outRefundNo'] ?? body['out_refund_no'];
    const outRefundNo =
      typeof outRefundNoRaw === 'string' ? outRefundNoRaw : '';
    if (!outRefundNo) throw new BadRequestException('缺少 outRefundNo');
    return outRefundNo;
  }

  private parseAlipaySandboxRefundNotify(
    payload: Record<string, string>,
  ): string {
    const outRefundNo = String(
      payload['out_request_no'] ?? payload['outRefundNo'] ?? '',
    );
    if (!outRefundNo) throw new BadRequestException('缺少 out_request_no');
    return outRefundNo;
  }

  private parseWechatRefundNotify(
    headers: Record<string, string>,
    rawBody: string,
  ): string {
    void headers;
    const parsed = JSON.parse(rawBody) as unknown;
    if (!this.isRecord(parsed)) throw new Error('微信退款回调解析失败');
    const body = parsed;

    const resource = body['resource'];
    if (
      this.isRecord(resource) &&
      typeof resource['out_refund_no'] === 'string'
    ) {
      return resource['out_refund_no'];
    }
    const outRefundNo = body['out_refund_no'];
    if (typeof outRefundNo === 'string') return outRefundNo;
    throw new Error('微信退款回调解析失败');
  }

  private parseAlipayRefundNotify(payload: Record<string, string>): string {
    const outRefundNo = payload['out_request_no'];
    if (!outRefundNo) throw new Error('支付宝退款回调解析失败');
    return String(outRefundNo);
  }

  private async markRefundSuccess(params: {
    refundId: string;
    providerRefundId: string | null;
  }): Promise<void>;
  private async markRefundSuccess(
    refundId: string,
    providerRefundId?: string,
  ): Promise<void>;
  private async markRefundSuccess(
    refundOrParams:
      | string
      | { refundId: string; providerRefundId: string | null },
    providerRefundIdRaw?: string,
  ): Promise<void> {
    const refundId =
      typeof refundOrParams === 'string'
        ? refundOrParams
        : refundOrParams.refundId;
    const providerRefundId =
      typeof refundOrParams === 'string'
        ? (providerRefundIdRaw ?? null)
        : refundOrParams.providerRefundId;

    await this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findUnique({
        where: { id: refundId },
        include: { order: true },
      });
      if (!refund) throw new NotFoundException('退款单不存在');
      if (refund.status === RefundStatus.SUCCESS) return;
      const order = refund.order;
      const orderTotal = order.paidAmountCents ?? order.amountCents;
      if (orderTotal <= 0) {
        throw new BadRequestException('订单金额异常，无法退款');
      }

      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.SUCCESS,
          refundId: providerRefundId ?? refund.refundId,
          finishedAt: new Date(),
        },
      });

      const totalRefunded =
        (
          await tx.refund.aggregate({
            where: { orderId: refund.orderId, status: RefundStatus.SUCCESS },
            _sum: { amountCents: true },
          })
        )._sum.amountCents ?? 0;
      const fullRefunded = totalRefunded >= orderTotal;

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: fullRefunded ? OrderStatus.REFUNDED : OrderStatus.PAID,
          refundedAt: fullRefunded ? new Date() : null,
        },
      });

      const ratio = refund.amountCents / orderTotal;
      const snapshot = order.productSnapshot as Record<string, unknown>;
      const rollbackPlan: Array<{ type: QuotaType; snapshotKey: string }> = [
        { type: QuotaType.PAPER_GENERATION, snapshotKey: 'paperQuota' },
        { type: QuotaType.POLISH, snapshotKey: 'polishQuota' },
        { type: QuotaType.EXPORT, snapshotKey: 'exportQuota' },
        { type: QuotaType.AI_CHAT, snapshotKey: 'aiChatQuota' },
      ];

      for (const item of rollbackPlan) {
        const baseQuota = Number(snapshot[item.snapshotKey] ?? 0);
        const rollback = Math.floor(baseQuota * ratio);
        if (rollback <= 0) continue;

        const q = await tx.userQuota.findUnique({
          where: {
            userId_quotaType: { userId: order.userId, quotaType: item.type },
          },
        });
        const balance = q?.balance ?? 0;
        const actualDeduct = Math.min(balance, rollback);
        if (actualDeduct <= 0 || !q) continue;

        await tx.userQuota.update({
          where: { id: q.id },
          data: {
            balance: { decrement: actualDeduct },
            totalOut: { increment: actualDeduct },
          },
        });
        await tx.quotaLog.create({
          data: {
            userId: order.userId,
            quotaType: item.type,
            change: -actualDeduct,
            balanceAfter: balance - actualDeduct,
            reason: QuotaChangeReason.REFUND,
            orderId: order.id,
            remark: `退款回滚（应扣 ${rollback}，实扣 ${actualDeduct}）`,
          },
        });
      }
    });
  }

  private async markRefundFailed(
    refundId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.update({
        where: { id: refundId },
        data: { status: RefundStatus.FAILED, errorMessage: reason },
      });
      await tx.order.update({
        where: { id: refund.orderId },
        data: { status: OrderStatus.PAID },
      });
    });
  }
}
