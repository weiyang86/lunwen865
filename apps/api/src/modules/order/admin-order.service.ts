import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentChannel, Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAdminOrderDto } from './dto/query-admin-order.dto';

@Injectable()
export class AdminOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryAdminOrderDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.OrderWhereInput = {};
    if (query.userId) where.userId = query.userId;
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

  async findOne(id: string) {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: { product: true, refunds: true, paymentLogs: true },
    });
    if (!o) throw new NotFoundException('订单不存在');
    return o;
  }

  async close(id: string) {
    const o = await this.prisma.order.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('订单不存在');
    if (o.status !== OrderStatus.PENDING) {
      throw new BadRequestException('仅 PENDING 订单可关闭');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CLOSED, cancelledAt: new Date() },
    });
  }

  async getStats() {
    const [totalOrders, paidOrders, paidSum] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.PAID } }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID },
        _sum: { paidAmountCents: true },
      }),
    ]);

    const now = dayjs();
    const todayStart = now.startOf('day').toDate();
    const weekStart = now.startOf('week').toDate();
    const monthStart = now.startOf('month').toDate();

    const [today, week, month] = await Promise.all([
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID, paidAt: { gte: todayStart } },
        _count: { _all: true },
        _sum: { paidAmountCents: true },
      }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID, paidAt: { gte: weekStart } },
        _count: { _all: true },
        _sum: { paidAmountCents: true },
      }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID, paidAt: { gte: monthStart } },
        _count: { _all: true },
        _sum: { paidAmountCents: true },
      }),
    ]);

    const byProduct = await this.prisma.order.groupBy({
      by: ['productId'],
      where: { status: OrderStatus.PAID },
      _sum: { paidAmountCents: true },
      _count: { _all: true },
    });

    const productIds = byProduct.map((x) => x.productId);
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const byChannel = await this.prisma.order.groupBy({
      by: ['channel'],
      where: { status: OrderStatus.PAID, channel: { not: null } },
      _count: { _all: true },
      _sum: { paidAmountCents: true },
    });

    return {
      totalOrders,
      paidOrders,
      paidAmountCents: paidSum._sum.paidAmountCents ?? 0,
      paid: {
        today: {
          count: today._count._all,
          amountCents: today._sum.paidAmountCents ?? 0,
        },
        week: {
          count: week._count._all,
          amountCents: week._sum.paidAmountCents ?? 0,
        },
        month: {
          count: month._count._all,
          amountCents: month._sum.paidAmountCents ?? 0,
        },
      },
      gmvByProduct: byProduct.map((x) => ({
        productId: x.productId,
        productCode: productMap.get(x.productId)?.code ?? '',
        productName: productMap.get(x.productId)?.name ?? '',
        paidOrderCount: x._count._all,
        amountCents: x._sum.paidAmountCents ?? 0,
      })),
      channelDistribution: byChannel.map((x) => ({
        channel: x.channel as PaymentChannel,
        paidOrderCount: x._count._all,
        amountCents: x._sum.paidAmountCents ?? 0,
      })),
    };
  }
}
