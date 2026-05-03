import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import dayjs from 'dayjs';
import { OrderStatus, PaymentChannel, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { RefundDto } from './dto/refund.dto';
import { PaymentService } from './payment.service';

@Controller('admin/payment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminPaymentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get('logs/:orderId')
  async logsByOrder(
    @Param('orderId') orderId: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const page = Math.max(1, Number(pageRaw ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeRaw ?? 20)));
    const skip = (page - 1) * pageSize;

    const where = { orderId };
    const [items, total] = await Promise.all([
      this.prisma.paymentLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.paymentLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  @Get('refunds')
  async refunds(
    @Query('orderId') orderId: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const page = Math.max(1, Number(pageRaw ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeRaw ?? 20)));
    const skip = (page - 1) * pageSize;

    const where = orderId ? { orderId } : {};
    const [items, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { order: true },
      }),
      this.prisma.refund.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  @Get('refunds/:id')
  refundDetail(@Param('id') id: string) {
    return this.prisma.refund.findUnique({
      where: { id },
      include: { order: true },
    });
  }

  @Post('refunds')
  refundApply(@CurrentUser('id') operatorId: string, @Body() dto: RefundDto) {
    return this.paymentService.createRefund({
      operatorId,
      orderId: dto.orderId,
      amountCents: dto.amountCents,
      reason: dto.reason,
    });
  }

  @Post('refund')
  refund(@CurrentUser('id') operatorId: string, @Body() dto: RefundDto) {
    return this.paymentService.createRefund({
      operatorId,
      orderId: dto.orderId,
      amountCents: dto.amountCents,
      reason: dto.reason,
    });
  }

  @Get('stats')
  async stats() {
    const revenueStatuses = [
      OrderStatus.PAID,
      OrderStatus.REFUNDING,
      OrderStatus.REFUNDED,
    ];
    const now = dayjs();
    const todayStart = now.startOf('day').toDate();
    const weekStart = now.startOf('week').toDate();
    const monthStart = now.startOf('month').toDate();

    const revenueExpr = { paidAmountCents: true } as const;

    const [
      today,
      week,
      month,
      total,
      refundAgg,
      byChannel,
      byProductRaw,
      recentOrders,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          status: { in: revenueStatuses },
          paidAt: { gte: todayStart },
        },
        _sum: revenueExpr,
      }),
      this.prisma.order.aggregate({
        where: {
          status: { in: revenueStatuses },
          paidAt: { gte: weekStart },
        },
        _sum: revenueExpr,
      }),
      this.prisma.order.aggregate({
        where: {
          status: { in: revenueStatuses },
          paidAt: { gte: monthStart },
        },
        _sum: revenueExpr,
      }),
      this.prisma.order.aggregate({
        where: { status: { in: revenueStatuses } },
        _sum: revenueExpr,
      }),
      this.prisma.refund.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amountCents: true },
      }),
      this.prisma.order.groupBy({
        by: ['channel'],
        where: {
          status: { in: revenueStatuses },
          channel: { not: null },
        },
        _sum: { paidAmountCents: true },
      }),
      this.prisma.order.groupBy({
        by: ['productId'],
        where: { status: { in: revenueStatuses } },
        _count: { _all: true },
        _sum: { paidAmountCents: true },
      }),
      this.prisma.order.findMany({
        where: { status: { in: revenueStatuses } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          product: { select: { code: true, name: true } },
          user: {
            select: { id: true, nickname: true, email: true, phone: true },
          },
        },
      }),
    ]);

    const productIds = byProductRaw.map((x) => x.productId);
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const channelBreakdown = { WECHAT: 0, ALIPAY: 0 };
    for (const item of byChannel) {
      const cents = item._sum.paidAmountCents ?? 0;
      if (item.channel === PaymentChannel.WECHAT)
        channelBreakdown.WECHAT += cents;
      if (item.channel === PaymentChannel.ALIPAY)
        channelBreakdown.ALIPAY += cents;
    }

    const totalRevenueCents = total._sum?.paidAmountCents ?? 0;
    const refundCents = refundAgg._sum.amountCents ?? 0;

    return {
      todayRevenueCents: today._sum?.paidAmountCents ?? 0,
      weekRevenueCents: week._sum?.paidAmountCents ?? 0,
      monthRevenueCents: month._sum?.paidAmountCents ?? 0,
      totalRevenueCents,
      channelBreakdown,
      productBreakdown: byProductRaw.map((x) => ({
        productCode: productMap.get(x.productId)?.code ?? '',
        productName: productMap.get(x.productId)?.name ?? '',
        count: x._count._all,
        revenueCents: x._sum.paidAmountCents ?? 0,
      })),
      refundCents,
      netRevenueCents: totalRevenueCents - refundCents,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        status: o.status,
        amountCents: o.paidAmountCents ?? o.amountCents,
        channel: o.channel,
        paidAt: o.paidAt,
        productCode: o.product.code,
        productName: o.product.name,
        user: o.user.nickname ?? o.user.email ?? o.user.phone ?? o.user.id,
      })),
    };
  }
}
