export interface MetricDelta {
  value: number;
  delta: number;
}

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface DashboardStats {
  metrics: {
    revenue: MetricDelta;
    orders: MetricDelta;
    newUsers: MetricDelta;
    conversionRate: MetricDelta;
  };
  trend: Array<{ date: string; revenue: number; orders: number }>;
  recentOrders: Array<{
    id: string;
    customerName: string;
    amount: number;
    status: OrderStatus;
    createdAt: string;
  }>;
}

