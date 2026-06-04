import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Order,
  OrderSourceType,
  OrderStatus,
  UserRole,
  PaymentChannel,
  PaymentLogType,
  PaymentMethod,
  Prisma,
  ProductStatus,
  QuotaChangeReason,
  QuotaType,
} from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaService } from '../quota/quota.service';
import { SettingsService } from '../settings/settings.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { generateOrderNo } from './utils/order-no.util';
import { assertTransition } from './utils/order-state.util';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: QuotaService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  private isPendingPaymentStatus(status: OrderStatus): boolean {
    return (
      status === OrderStatus.PENDING || status === OrderStatus.PENDING_PAYMENT
    );
  }

  private isPaidStatus(status: OrderStatus): boolean {
    return (
      status === OrderStatus.PAID ||
      status === OrderStatus.FULFILLING ||
      status === OrderStatus.COMPLETED
    );
  }

  private isExpiredOrder(
    order: Pick<Order, 'status' | 'expiresAt'>,
    now = new Date(),
  ): boolean {
    return (
      order.status === OrderStatus.CLOSED ||
      (this.isPendingPaymentStatus(order.status) &&
        order.expiresAt.getTime() <= now.getTime())
    );
  }

  private remainingSeconds(expiresAt: Date, now = new Date()): number {
    return Math.max(
      0,
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
    );
  }

  private publicOrderStatus(
    order: Pick<Order, 'status' | 'expiresAt'>,
    now = new Date(),
  ): string {
    if (this.isPaidStatus(order.status)) return 'PAID';
    if (this.isExpiredOrder(order, now)) return 'EXPIRED';
    if (order.status === OrderStatus.CANCELLED) return 'CANCELLED';
    if (this.isPendingPaymentStatus(order.status)) return 'PENDING';
    return order.status;
  }

  private paymentStatus(
    order: Pick<Order, 'status' | 'expiresAt'>,
    now = new Date(),
  ): string {
    if (this.isPaidStatus(order.status)) return 'SUCCEEDED';
    if (this.isExpiredOrder(order, now)) return 'CLOSED';
    if (order.status === OrderStatus.CANCELLED) return 'CLOSED';
    return 'PENDING';
  }

  async expirePendingOrderIfNeeded<T extends Order>(
    order: T,
    now = new Date(),
  ): Promise<T> {
    if (
      !this.isPendingPaymentStatus(order.status) ||
      order.expiresAt.getTime() > now.getTime()
    ) {
      return order;
    }
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CLOSED,
        cancelledAt: now,
        remark: order.remark ?? '支付超时自动过期',
      },
    });
    const paymentRecordModel = (
      this.prisma as unknown as Record<string, unknown>
    )['paymentRecord'] as
      | {
          updateMany: (args: {
            where: Record<string, unknown>;
            data: Record<string, unknown>;
          }) => Promise<unknown>;
        }
      | undefined;
    await paymentRecordModel?.updateMany({
      where: { orderId: order.id, status: 'PENDING' },
      data: { status: 'CLOSED' },
    });
    return { ...order, ...updated };
  }

  private withPaymentExpiryView<T extends Order>(order: T, now = new Date()) {
    const publicStatus = this.publicOrderStatus(order, now);
    const remainingSeconds = this.remainingSeconds(order.expiresAt, now);
    return {
      ...order,
      orderStatus: publicStatus,
      paymentStatus: this.paymentStatus(order, now),
      paid: this.isPaidStatus(order.status),
      expired: publicStatus === 'EXPIRED',
      canPay: publicStatus === 'PENDING' && remainingSeconds > 0,
      expiredAt: order.expiresAt,
      remainingSeconds,
    };
  }

  async create(userId: string, dto: CreateOrderDto, clientIp?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('商品不存在');
    if (product.status !== ProductStatus.ACTIVE)
      throw new BadRequestException('该商品已下架');

    const paymentSettings = await this.settings.getPaymentSettings();
    const expireMinutes =
      paymentSettings.orderExpireMinutes ||
      this.config.get<number>('payment.orderExpireMinutes', 10);
    const expiresAt = dayjs().add(expireMinutes, 'minute').toDate();

    const productSnapshot: Prisma.InputJsonValue = {
      id: product.id,
      code: product.code,
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
      originalPriceCents: product.originalPriceCents,
      brainCellAmount: product.brainCellAmount,
      paperQuota: product.paperQuota,
      polishQuota: product.polishQuota,
      exportQuota: product.exportQuota,
      aiChatQuota: product.aiChatQuota,
      status: product.status,
      sortOrder: product.sortOrder,
    };

    const order = await this.prisma.order.create({
      data: {
        orderNo: generateOrderNo(),
        userId,
        productId: product.id,
        productSnapshot,
        amountCents: product.priceCents,
        status: OrderStatus.PENDING,
        sourceType: OrderSourceType.DIRECT,
        agencyId: null,
        expiresAt,
        clientIp: clientIp ?? null,
        remark: dto.remark ?? null,
      },
    });

    await this.prisma.paymentLog.create({
      data: {
        orderId: order.id,
        type: PaymentLogType.CREATE,
        success: true,
        request: { dto, clientIp } as unknown as Prisma.InputJsonValue,
      },
    });

    return order;
  }

  async findAll(userId: string, query: QueryOrderDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.OrderWhereInput = { userId };
    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    await this.closeExpired();

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { product: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    const now = new Date();
    const normalizedItems = items.map((item) =>
      this.withPaymentExpiryView(item, now),
    );
    return { items: normalizedItems, total, page, pageSize };
  }

  async findOne(userId: string, id: string) {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: {
        product: true,
        refunds: true,
        task: {
          select: {
            id: true,
            status: true,
            currentStage: true,
            title: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!o) throw new NotFoundException('订单不存在');
    if (o.userId !== userId) throw new ForbiddenException('无权访问该订单');
    return o;
  }

  async cancel(userId: string, id: string) {
    const order = await this.findOne(userId, id);
    assertTransition(order.status, OrderStatus.CANCELLED);
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  async markPaid(params: {
    orderId: string;
    transactionId: string;
    paidAmountCents: number;
    method: PaymentMethod;
    channel: PaymentChannel;
    paidAt: Date;
  }): Promise<{ order: Order; alreadyPaid: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.orderId },
      });
      if (!order) throw new NotFoundException('订单不存在');

      if (this.isPaidStatus(order.status)) {
        return { order, alreadyPaid: true };
      }
      const orderExpiresAt = order.expiresAt ?? new Date(Date.now() + 60_000);
      const paidBeforeExpiry =
        params.paidAt.getTime() <= orderExpiresAt.getTime();
      const canSettleExpired =
        order.status === OrderStatus.CLOSED && paidBeforeExpiry;
      if (!this.isPendingPaymentStatus(order.status) && !canSettleExpired) {
        throw new BadRequestException(
          `订单状态 ${order.status}，无法标记为已支付`,
        );
      }
      if (this.isPendingPaymentStatus(order.status) && !paidBeforeExpiry) {
        throw new BadRequestException('订单已过期，支付成功时间晚于订单有效期');
      }

      if (params.paidAmountCents !== order.amountCents) {
        this.logger.warn(
          `[Order] 金额不匹配 应付 ${order.amountCents} 实付 ${params.paidAmountCents}`,
        );
      }

      if (params.transactionId) {
        const dup = await tx.order.findFirst({
          where: {
            transactionId: params.transactionId,
            id: { not: order.id },
          },
          select: { id: true, orderNo: true },
        });
        if (dup) {
          throw new BadRequestException(
            `交易号已被其他订单使用：${dup.orderNo}`,
          );
        }
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          paidAt: params.paidAt,
          paidAmountCents: params.paidAmountCents,
          transactionId: params.transactionId,
          method: params.method,
          channel: params.channel,
        },
      });

      const final = await this.grantQuota(tx, updated);

      return { order: final, alreadyPaid: false };
    });
  }

  private async grantQuota(
    tx: Prisma.TransactionClient,
    order: Order,
  ): Promise<Order> {
    if (order.quotaGranted) return order;
    const snap = order.productSnapshot as unknown as Record<string, unknown>;
    const brainCellFromSnapshot = Number(snap['brainCellAmount'] ?? 0);
    const paperQuota = Number(snap['paperQuota'] ?? 0);
    const polishQuota = Number(snap['polishQuota'] ?? 0);
    const exportQuota = Number(snap['exportQuota'] ?? 0);
    const aiChatQuota = Number(snap['aiChatQuota'] ?? 0);

    const fallbackBrainCells =
      paperQuota + polishQuota + exportQuota + aiChatQuota;
    const brainCellAmount =
      brainCellFromSnapshot > 0 ? brainCellFromSnapshot : fallbackBrainCells;

    if (brainCellAmount > 0) {
      await this.quotaService.grant({
        userId: order.userId,
        type: QuotaType.BRAIN_CELL,
        amount: brainCellAmount,
        reason: QuotaChangeReason.PURCHASE,
        orderId: order.id,
        tx,
      });
    }
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { quotaGranted: true },
    });
    return updated;
  }

  async closeExpired(): Promise<number> {
    const expired = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT] },
        expiresAt: { lt: new Date() },
      },
      select: { id: true },
    });
    if (!expired.length) return 0;
    await this.prisma.order.updateMany({
      where: { id: { in: expired.map((e) => e.id) } },
      data: {
        status: OrderStatus.CLOSED,
        cancelledAt: new Date(),
        remark: '支付超时自动过期',
      },
    });
    this.logger.log(`[OrderCleanup] 标记过期订单 ${expired.length} 条`);
    return expired.length;
  }

  async getPaymentStatus(
    requester: { id: string; role?: UserRole | null },
    id: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { task: { select: { id: true } } },
    });
    if (!order) throw new NotFoundException('订单不存在');

    const isAdmin =
      requester.role === UserRole.ADMIN ||
      requester.role === UserRole.SUPER_ADMIN;
    if (!isAdmin && order.userId !== requester.id) {
      throw new ForbiddenException('无权访问该订单');
    }

    const latest = await this.expirePendingOrderIfNeeded(order);

    const quota = await this.prisma.userQuota.findUnique({
      where: {
        userId_quotaType: {
          userId: latest.userId,
          quotaType: QuotaType.BRAIN_CELL,
        },
      },
      select: { balance: true },
    });
    const now = new Date();
    const publicStatus = this.publicOrderStatus(latest, now);
    const paid = this.isPaidStatus(latest.status);
    const expired = publicStatus === 'EXPIRED';
    const taskId = latest.taskId ?? latest.task?.id ?? null;
    const redirectUrl = taskId
      ? `/tasks?taskId=${encodeURIComponent(taskId)}`
      : paid
        ? '/account'
        : '/orders';
    const remainingSeconds = this.remainingSeconds(latest.expiresAt, now);
    const message = paid
      ? '已支付'
      : expired
        ? '订单已过期，请重新下单'
        : '待支付';

    return {
      orderId: latest.id,
      orderNo: latest.orderNo,
      orderStatus: publicStatus,
      paymentStatus: this.paymentStatus(latest, now),
      status: publicStatus,
      paid,
      expired,
      canPay: publicStatus === 'PENDING' && remainingSeconds > 0,
      paidAt: latest.paidAt,
      paidAmountCents: latest.paidAmountCents,
      channel: latest.channel,
      method: latest.method,
      outTradeNo: latest.outTradeNo,
      transactionId: latest.transactionId,
      expiredAt: latest.expiresAt,
      expiresAt: latest.expiresAt,
      remainingSeconds,
      taskId,
      redirectUrl,
      message,
      brainCellBalance: quota?.balance ?? 0,
    };
  }
}
