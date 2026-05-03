import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { assertTransition, canTransition } from './order-state.util';

describe('order-state.util', () => {
  it('canTransition：允许的流转返回 true', () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.PAID)).toBe(true);
    expect(canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.PAID)).toBe(
      true,
    );
    expect(canTransition(OrderStatus.PAID, OrderStatus.FULFILLING)).toBe(true);
    expect(canTransition(OrderStatus.PAID, OrderStatus.REFUNDING)).toBe(true);
    expect(canTransition(OrderStatus.FULFILLING, OrderStatus.COMPLETED)).toBe(
      true,
    );
    expect(canTransition(OrderStatus.REFUNDING, OrderStatus.REFUNDED)).toBe(
      true,
    );
  });

  it('canTransition：不允许的流转返回 false', () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(false);
    expect(canTransition(OrderStatus.REFUNDED, OrderStatus.PAID)).toBe(false);
  });

  it('assertTransition：不允许时抛 BadRequestException', () => {
    expect(() =>
      assertTransition(OrderStatus.PAID, OrderStatus.CANCELLED),
    ).toThrow(BadRequestException);
  });
});
