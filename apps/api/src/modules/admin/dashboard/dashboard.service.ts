import { Injectable } from '@nestjs/common';
import { OrderStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface MetricDelta {
  value: number;
  delta: number;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function percentDelta(curr: number, prev: number) {
  if (prev === 0) return curr === 0 ? 0 : 100;
  const v = ((curr - prev) / prev) * 100;
  return Math.round(v * 10) / 10;
}

function toYuan(cents: number | null | undefined) {
  const v = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  return Math.round(v / 100);
}

function mapOrderStatus(
  s: OrderStatus,
): 'PAID' | 'PENDING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' {
  if (s === OrderStatus.PAID) return 'PAID';
  if (s === OrderStatus.FULFILLING) return 'SHIPPED';
  if (s === OrderStatus.COMPLETED) return 'COMPLETED';
  if (s === OrderStatus.PENDING || s === OrderStatus.PENDING_PAYMENT)
    return 'PENDING';
  return 'CANCELLED';
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<{
    metrics: Record<string, MetricDelta>;
    trend: Array<{ date: string; revenue: number; orders: number }>;
    recentOrders: Array<{
      id: string;
      customerName: string;
      amount: number;
      status: 'PAID' | 'PENDING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
      createdAt: string;
    }>;
    ops: {
      tasks: { active: number; pendingReview: number; failed24h: number };
      ai: { runs24h: number; failed24h: number; failureRate: number };
    };
  }> {
    const now = new Date();
    const today0 = startOfDay(now);

    const currStart = addDays(today0, -7);
    const prevStart = addDays(today0, -14);

    const [currOrders, prevOrders, currUsers, prevUsers] =
      await this.prisma.$transaction([
        this.prisma.order.count({
          where: { createdAt: { gte: currStart, lt: now } },
        }),
        this.prisma.order.count({
          where: { createdAt: { gte: prevStart, lt: currStart } },
        }),
        this.prisma.user.count({
          where: { createdAt: { gte: currStart, lt: now } },
        }),
        this.prisma.user.count({
          where: { createdAt: { gte: prevStart, lt: currStart } },
        }),
      ]);

    const [currPaidOrders, prevPaidOrders] = await this.prisma.$transaction([
      this.prisma.order.count({
        where: {
          createdAt: { gte: currStart, lt: now },
          paidAt: { not: null },
        },
      }),
      this.prisma.order.count({
        where: {
          createdAt: { gte: prevStart, lt: currStart },
          paidAt: { not: null },
        },
      }),
    ]);

    const [currRevenueAgg, prevRevenueAgg] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where: { paidAt: { gte: currStart, lt: now } },
        _sum: { paidAmountCents: true },
      }),
      this.prisma.order.aggregate({
        where: { paidAt: { gte: prevStart, lt: currStart } },
        _sum: { paidAmountCents: true },
      }),
    ]);

    const currRevenue = toYuan(currRevenueAgg._sum.paidAmountCents);
    const prevRevenue = toYuan(prevRevenueAgg._sum.paidAmountCents);

    const currConversion =
      currOrders === 0
        ? 0
        : Math.round((currPaidOrders / currOrders) * 100 * 10) / 10;
    const prevConversion =
      prevOrders === 0
        ? 0
        : Math.round((prevPaidOrders / prevOrders) * 100 * 10) / 10;

    const metrics = {
      revenue: {
        value: currRevenue,
        delta: percentDelta(currRevenue, prevRevenue),
      },
      orders: {
        value: currOrders,
        delta: percentDelta(currOrders, prevOrders),
      },
      newUsers: { value: currUsers, delta: percentDelta(currUsers, prevUsers) },
      conversionRate: {
        value: currConversion,
        delta: Math.round((currConversion - prevConversion) * 10) / 10,
      },
    } satisfies Record<string, MetricDelta>;

    const trend: Array<{ date: string; revenue: number; orders: number }> = [];
    for (let i = 13; i >= 0; i -= 1) {
      const day = addDays(today0, -i);
      const next = addDays(day, 1);
      const [paidAgg, orderCount] = await this.prisma.$transaction([
        this.prisma.order.aggregate({
          where: { paidAt: { gte: day, lt: next } },
          _sum: { paidAmountCents: true },
        }),
        this.prisma.order.count({
          where: { createdAt: { gte: day, lt: next } },
        }),
      ]);
      trend.push({
        date: day.toISOString().slice(0, 10),
        revenue: toYuan(paidAgg._sum.paidAmountCents),
        orders: orderCount,
      });
    }

    const recent = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        orderNo: true,
        amountCents: true,
        paidAmountCents: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            realName: true,
            nickname: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    const recentOrders = recent.map((o) => {
      const u = o.user;
      const customerName =
        u.realName?.trim() ||
        u.nickname?.trim() ||
        u.phone?.trim() ||
        u.email?.trim() ||
        '—';
      const amount = toYuan(o.paidAmountCents ?? o.amountCents);
      return {
        id: o.orderNo,
        customerName,
        amount,
        status: mapOrderStatus(o.status),
        createdAt: o.createdAt.toISOString(),
      };
    });

    const pendingReviewStatuses: TaskStatus[] = [
      TaskStatus.TOPIC_PENDING_REVIEW,
      TaskStatus.OPENING_PENDING_REVIEW,
      TaskStatus.OUTLINE_PENDING_REVIEW,
      TaskStatus.ABSTRACT_PENDING_REVIEW,
    ];
    const activeExcluded: TaskStatus[] = [
      TaskStatus.CANCELLED,
      TaskStatus.DONE,
      TaskStatus.FAILED,
    ];
    const since24h = new Date(now.getTime() - 24 * 3600_000);

    const [
      activeTasks,
      pendingReviewTasks,
      failedTasks24h,
      aiRuns24h,
      aiFailed24h,
    ] = await this.prisma.$transaction([
      this.prisma.task.count({ where: { status: { notIn: activeExcluded } } }),
      this.prisma.task.count({
        where: { status: { in: pendingReviewStatuses } },
      }),
      this.prisma.task.count({
        where: { status: TaskStatus.FAILED, updatedAt: { gte: since24h } },
      }),
      this.prisma.aiGenerationRun.count({
        where: { createdAt: { gte: since24h } },
      }),
      this.prisma.aiGenerationRun.count({
        where: { createdAt: { gte: since24h }, status: 'FAILED' },
      }),
    ]);

    const failureRate =
      aiRuns24h === 0
        ? 0
        : Math.round((aiFailed24h / aiRuns24h) * 100 * 10) / 10;

    return {
      metrics,
      trend,
      recentOrders,
      ops: {
        tasks: {
          active: activeTasks,
          pendingReview: pendingReviewTasks,
          failed24h: failedTasks24h,
        },
        ai: { runs24h: aiRuns24h, failed24h: aiFailed24h, failureRate },
      },
    };
  }
}
