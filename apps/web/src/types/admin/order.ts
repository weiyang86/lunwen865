/** @deprecated ORD-1 起请使用 `src/types/order.ts` 内的新领域模型类型（ThesisOrder 等） */
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'FULFILLING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDING'
  | 'REFUNDED';

/** @deprecated ORD-1 起请使用 `src/types/order.ts` 内的新领域模型类型 */
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED';

/** @deprecated ORD-1 起请使用 `src/types/order.ts` 内的新领域模型类型 */
export interface OrderListItem {
  id: string;
  orderNo: string;
  status: OrderStatus;
  totalAmount: number;
  payAmount: number;
  discount: number;
  createdAt: string;
  paidAt: string | null;
  user: {
    id: string;
    phone: string | null;
    nickname: string | null;
    avatar?: string | null;
  };
  _count: { items: number };
  thesis?: import('@/types/order').ThesisInfo | null;
  currentStage?: import('@/types/order').StageType | null;
  dueDate?: string | null;
  primaryTutorId?: string | null;
  primaryTutor?: { id: string; name: string; email: string | null } | null;
  taskId?: string | null;
}

/** @deprecated ORD-1 起请使用 `src/types/order.ts` 内的新领域模型类型 */
export interface OrderListResp {
  items: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** @deprecated ORD-1 起请使用 `src/types/order.ts` 内的新领域模型类型 */
export interface OrderStats {
  total: number;
  paid: number;
  refunded: number;
  revenue: number;
}

/** @deprecated ORD-1 起请使用 `src/types/order.ts` 内的新领域模型类型 */
export interface ListOrdersQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: 'ALL' | OrderStatus;
  startDate?: string;
  endDate?: string;
  currentStage?: import('@/types/order').StageType;
  tutorId?: string;
  primaryTutorId?: string;
  dueDateBefore?: string;
}

/** @deprecated ORD-1 起请使用 `src/types/order.ts` 内的新领域模型类型 */
export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  skuName: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

/** @deprecated ORD-1 起请使用 `src/types/order.ts` 内的新领域模型类型 */
export interface Refund {
  id: string;
  orderId: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  rejectReason: string | null;
  operatorId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** @deprecated ORD-1 起请使用 `src/types/order.ts` 内的新领域模型类型 */
export interface OrderDetail {
  id: string;
  orderNo: string;
  status: OrderStatus;
  totalAmount: number;
  payAmount: number;
  discount: number;
  remark: string | null;
  paidAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    phone: string | null;
    nickname: string | null;
    avatar: string | null;
  };
  items: OrderItem[];
  refunds: Refund[];
  thesis?: import('@/types/order').ThesisInfo | null;
  currentStage?: import('@/types/order').StageType | null;
  dueDate?: string | null;
  primaryTutorId?: string | null;
  primaryTutor?: { id: string; name: string; email: string | null } | null;
  taskId?: string | null;
}
