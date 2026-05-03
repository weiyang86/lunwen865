import { Injectable } from '@nestjs/common';

export interface MetricDelta {
  value: number;
  delta: number;
}

@Injectable()
export class DashboardService {
  getStats(): {
    metrics: Record<string, MetricDelta>;
    trend: Array<{ date: string; revenue: number; orders: number }>;
    recentOrders: Array<{
      id: string;
      customerName: string;
      amount: number;
      status: 'PAID' | 'PENDING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
      createdAt: string;
    }>;
  } {
    const today = new Date();
    const days: Array<{ date: string; revenue: number; orders: number }> = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const base = 8000 + Math.sin(i / 2) * 2000;
      days.push({
        date: d.toISOString().slice(0, 10),
        revenue: Math.round(base + Math.random() * 3000),
        orders: Math.round(40 + Math.random() * 30),
      });
    }

    const recentOrders = Array.from({ length: 10 }).map((_, i) => ({
      id: `ORD${String(20240500 + i).padStart(8, '0')}`,
      customerName: ['张伟', '李娜', '王芳', '刘洋', '陈晨'][i % 5],
      amount: Math.round(100 + Math.random() * 2000),
      status: (
        ['PAID', 'PENDING', 'SHIPPED', 'COMPLETED', 'CANCELLED'] as const
      )[i % 5],
      createdAt: new Date(Date.now() - i * 3600_000).toISOString(),
    }));

    const metrics: Record<string, MetricDelta> = {
      revenue: { value: 158420, delta: 12.5 },
      orders: { value: 642, delta: 8.3 },
      newUsers: { value: 89, delta: -3.2 },
      conversionRate: { value: 3.4, delta: 0.6 },
    };

    return { metrics, trend: days, recentOrders };
  }
}
