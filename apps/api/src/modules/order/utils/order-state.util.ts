import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.CLOSED],
  PENDING_PAYMENT: [
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
    OrderStatus.CLOSED,
  ],
  PAID: [OrderStatus.FULFILLING, OrderStatus.REFUNDING],
  FULFILLING: [OrderStatus.COMPLETED, OrderStatus.REFUNDING],
  COMPLETED: [],
  REFUNDING: [OrderStatus.REFUNDED, OrderStatus.PAID, OrderStatus.FULFILLING],
  REFUNDED: [],
  CANCELLED: [],
  CLOSED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(`订单状态不可从 ${from} 变更为 ${to}`);
  }
}
