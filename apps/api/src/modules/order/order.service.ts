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
  OrderStatus,
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
  ) {}

  async create(userId: string, dto: CreateOrderDto, clientIp?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('商品不存在');
    if (product.status !== ProductStatus.ACTIVE)
      throw new BadRequestException('该商品已下架');

    const expireMinutes = this.config.get<number>(
      'payment.orderExpireMinutes',
      30,
    );
    const expiresAt = dayjs().add(expireMinutes, 'minute').toDate();

    const productSnapshot: Prisma.InputJsonValue = {
      id: product.id,
      code: product.code,
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
      originalPriceCents: product.originalPriceCents,
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
      include: { product: true, refunds: true },
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

      if (order.status === OrderStatus.PAID) {
        return { order, alreadyPaid: true };
      }
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          `订单状态 ${order.status}，无法标记为已支付`,
        );
      }

      if (params.paidAmountCents !== order.amountCents) {
        this.logger.warn(
          `[Order] 金额不匹配 应付 ${order.amountCents} 实付 ${params.paidAmountCents}`,
        );
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
    const paperQuota = Number(snap['paperQuota'] ?? 0);
    const polishQuota = Number(snap['polishQuota'] ?? 0);
    const exportQuota = Number(snap['exportQuota'] ?? 0);
    const aiChatQuota = Number(snap['aiChatQuota'] ?? 0);

    if (paperQuota > 0) {
      await this.quotaService.grant({
        userId: order.userId,
        type: QuotaType.PAPER_GENERATION,
        amount: paperQuota,
        reason: QuotaChangeReason.PURCHASE,
        orderId: order.id,
        tx,
      });
    }
    if (polishQuota > 0) {
      await this.quotaService.grant({
        userId: order.userId,
        type: QuotaType.POLISH,
        amount: polishQuota,
        reason: QuotaChangeReason.PURCHASE,
        orderId: order.id,
        tx,
      });
    }
    if (exportQuota > 0) {
      await this.quotaService.grant({
        userId: order.userId,
        type: QuotaType.EXPORT,
        amount: exportQuota,
        reason: QuotaChangeReason.PURCHASE,
        orderId: order.id,
        tx,
      });
    }
    if (aiChatQuota > 0) {
      await this.quotaService.grant({
        userId: order.userId,
        type: QuotaType.AI_CHAT,
        amount: aiChatQuota,
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
}
