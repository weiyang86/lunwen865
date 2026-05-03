import type { OrderListItem } from '@/types/admin/order';
import type { StageType, ThesisInfo, ThesisOrder, ThesisOrderStatus } from '@/types/order';

export type RawAdminOrder = OrderListItem & {
  thesis?: ThesisInfo | null;
  currentStage?: StageType | null;
  dueDate?: string | null;
  primaryTutorId?: string | null;
  primaryTutor?: { id: string; name: string; email: string | null } | null;
  taskId?: string | null;
};

export function adaptToThesisOrder(raw: RawAdminOrder): ThesisOrder {
  return {
    id: raw.id,
    orderNo: raw.orderNo,
    status: mapOrderStatus(raw.status),
    user: raw.user,
    thesis: raw.thesis ?? null,
    currentStage: raw.currentStage ?? null,
    dueDate: raw.dueDate ?? null,
    primaryTutorId: raw.primaryTutorId ?? null,
    primaryTutor: raw.primaryTutor ?? null,
    taskId: raw.taskId ?? null,
    payment: {
      currency: 'CNY',
      totalCents: raw.totalAmount,
      paidCents: raw.payAmount,
      discountCents: raw.discount,
    },
    createdAt: raw.createdAt,
    paidAt: raw.paidAt,
    updatedAt: raw.createdAt,
    stages: [],
  };
}

export function mapOrderStatus(raw: string): ThesisOrderStatus {
  if (raw === 'PENDING' || raw === 'PENDING_PAYMENT') return 'pending_deposit';
  if (raw === 'PAID' || raw === 'FULFILLING') return 'in_progress';
  if (raw === 'COMPLETED') return 'completed';
  if (raw === 'CANCELLED' || raw === 'CLOSED') return 'cancelled';
  if (raw === 'REFUNDING') return 'refunding';
  if (raw === 'REFUNDED') return 'refunded';
  console.warn('[ORD-2] unknown order status:', raw);
  return 'in_progress';
}
