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
      this.config.get<number>('payment.orderExpireMinutes', 30);
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

    return { items, total, page, pageSize };
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

      if (
        order.status === OrderStatus.PAID ||
        order.status === OrderStatus.FULFILLING ||
        order.status === OrderStatus.COMPLETED
      ) {
        return { order, alreadyPaid: true };
      }
      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.PENDING_PAYMENT
      ) {
        throw new BadRequestException(
          `订单状态 ${order.status}，无法标记为已支付`,
        );
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
      where: { status: OrderStatus.PENDING, expiresAt: { lt: new Date() } },
      select: { id: true },
    });
    if (!expired.length) return 0;
    await this.prisma.order.updateMany({
      where: { id: { in: expired.map((e) => e.id) } },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        remark: '超时未支付自动关闭',
      },
    });
    this.logger.log(`[OrderCleanup] 关闭过期订单 ${expired.length} 条`);
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

    const quota = await this.prisma.userQuota.findUnique({
      where: {
        userId_quotaType: {
          userId: order.userId,
          quotaType: QuotaType.BRAIN_CELL,
        },
      },
      select: { balance: true },
    });
    const paid =
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.FULFILLING ||
      order.status === OrderStatus.COMPLETED;
    const taskId = order.taskId ?? order.task?.id ?? null;
    const redirectUrl = taskId
      ? `/tasks?taskId=${encodeURIComponent(taskId)}`
      : paid
        ? '/account'
        : '/orders';

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      orderStatus: order.status,
      paymentStatus: paid ? 'PAID' : order.status,
      status: order.status,
      paid,
      paidAt: order.paidAt,
      paidAmountCents: order.paidAmountCents,
      channel: order.channel,
      method: order.method,
      outTradeNo: order.outTradeNo,
      transactionId: order.transactionId,
      expiresAt: order.expiresAt,
      taskId,
      redirectUrl,
      brainCellBalance: quota?.balance ?? 0,
    };
  }
}
