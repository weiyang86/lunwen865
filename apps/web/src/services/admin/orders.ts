import { adminHttp } from '@/lib/admin/api-client';
import type {
  ListOrdersQuery,
  OrderDetail,
  OrderListResp,
  OrderStats,
  OrderStatus,
  Refund,
  RefundStatus,
} from '@/types/admin/order';
import { adaptToThesisOrder, type RawAdminOrder } from '@/adapters/order-adapter';
import type { ThesisOrder } from '@/types/order';

export type ThesisOrderListResp = Omit<OrderListResp, 'items'> & {
  items: ThesisOrder[];
};

export async function fetchOrders(q: ListOrdersQuery): Promise<ThesisOrderListResp> {
  const raw = await adminHttp.get<OrderListResp>('/admin/orders', q);
  return {
    ...raw,
    items: raw.items.map((it) => adaptToThesisOrder(it as RawAdminOrder)),
  };
}

export async function fetchOrderStats(range?: { startDate?: string; endDate?: string }) {
  return adminHttp.get<OrderStats>('/admin/orders/stats', range);
}

function normalizeOrderStatus(raw: string): OrderStatus {
  if (raw === 'PENDING' || raw === 'PENDING_PAYMENT') return 'PENDING_PAYMENT';
  if (raw === 'PAID') return 'PAID';
  if (raw === 'FULFILLING') return 'FULFILLING';
  if (raw === 'COMPLETED') return 'COMPLETED';
  if (raw === 'CANCELLED' || raw === 'CLOSED') return 'CANCELLED';
  if (raw === 'REFUNDING') return 'REFUNDING';
  return 'REFUNDED';
}

function normalizeRefundStatus(raw: string): RefundStatus {
  if (raw === 'PENDING') return 'PENDING';
  if (raw === 'APPROVED') return 'APPROVED';
  if (raw === 'REJECTED') return 'REJECTED';
  if (raw === 'SUCCESS') return 'SUCCESS';
  return 'FAILED';
}

function mapRefund(raw: any): Refund {
  return {
    id: String(raw.id),
    orderId: String(raw.orderId),
    amount: Number(raw.amountCents ?? raw.amount ?? 0),
    reason: String(raw.reason ?? ''),
    status: normalizeRefundStatus(String(raw.status ?? 'PENDING')),
    rejectReason: raw.rejectReason ?? null,
    operatorId: raw.operatorId ?? null,
    createdAt: String(raw.createdAt),
    resolvedAt: raw.resolvedAt ?? raw.finishedAt ?? null,
  };
}

export async function fetchOrderDetail(id: string): Promise<OrderDetail> {
  const raw = await adminHttp.get<any>(`/admin/orders/${id}`);
  return {
    id: String(raw.id),
    orderNo: String(raw.orderNo),
    status: normalizeOrderStatus(String(raw.status)),
    totalAmount: Number(raw.amountCents ?? raw.totalAmount ?? 0),
    payAmount: Number(raw.paidAmountCents ?? raw.payAmount ?? raw.amountCents ?? 0),
    discount: Number(raw.discountCents ?? raw.discount ?? 0),
    remark: raw.remark ?? null,
    paidAt: raw.paidAt ?? null,
    completedAt: raw.completedAt ?? null,
    cancelledAt: raw.cancelledAt ?? null,
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
    user: {
      id: String(raw.user?.id ?? ''),
      phone: raw.user?.phone ?? null,
      nickname: raw.user?.nickname ?? null,
      avatar: raw.user?.avatar ?? null,
    },
    items: Array.isArray(raw.items)
      ? raw.items.map((it: any) => ({
          id: String(it.id),
          productId: String(it.productId),
          productName: String(it.productName),
          skuName: it.skuName ?? null,
          unitPrice: Number(it.unitPrice),
          quantity: Number(it.quantity),
          subtotal: Number(it.subtotal),
        }))
      : [],
    refunds: Array.isArray(raw.refunds) ? raw.refunds.map(mapRefund) : [],
    thesis: raw.thesis ?? null,
    currentStage: raw.currentStage ?? null,
    dueDate: raw.dueDate ?? null,
    primaryTutorId: raw.primaryTutorId ?? null,
    primaryTutor: raw.primaryTutor ?? null,
    taskId: raw.taskId ?? null,
  };
}

export async function updateOrderStatus(
  id: string,
  status: 'FULFILLING' | 'COMPLETED' | 'CANCELLED',
) {
  const r = await adminHttp.patch<{ id: string; status: string }>(
    `/admin/orders/${id}/status`,
    { status },
  );
  return { id: r.id, status: normalizeOrderStatus(r.status) };
}

export async function createRefund(id: string, payload: { amount: number; reason: string }) {
  const r = await adminHttp.post<any>(`/admin/orders/${id}/refunds`, payload);
  return mapRefund(r);
}

export async function resolveRefund(
  refundId: string,
  payload: { action: 'APPROVED' } | { action: 'REJECTED'; rejectReason: string },
) {
  const r = await adminHttp.patch<any>(`/admin/orders/refunds/${refundId}`, payload);
  return mapRefund(r);
}

export async function linkOrderToTask(orderId: string, taskId: string) {
  return adminHttp.patch<OrderDetail>(`/admin/orders/${orderId}/link-task`, { taskId });
}

export async function unlinkOrderFromTask(orderId: string) {
  return adminHttp.delete<OrderDetail>(`/admin/orders/${orderId}/link-task`);
}

export async function assignOrderTutor(orderId: string, primaryTutorId: string) {
  return adminHttp.patch<OrderDetail>(`/admin/orders/${orderId}/assign-tutor`, { primaryTutorId });
}

export async function unassignOrderTutor(orderId: string) {
  return adminHttp.patch<OrderDetail>(`/admin/orders/${orderId}/unassign-tutor`);
}
