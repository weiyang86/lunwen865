export const BACKEND_TASK_STATUSES = [
  'INIT',
  'TOPIC_GENERATING',
  'TOPIC_PENDING_REVIEW',
  'TOPIC_APPROVED',
  'OPENING_GENERATING',
  'OPENING_PENDING_REVIEW',
  'OPENING_APPROVED',
  'OUTLINE_GENERATING',
  'OUTLINE_PENDING_REVIEW',
  'OUTLINE_APPROVED',
  'WRITING',
  'WRITING_PAUSED',
  'MERGING',
  'FORMATTING',
  'REVIEW',
  'REVISION',
  'DONE',
  'FAILED',
  'CANCELLED',
] as const;

export type BackendTaskStatus = (typeof BACKEND_TASK_STATUSES)[number];

export const BACKEND_TASK_STAGES = [
  'TOPIC',
  'OPENING',
  'OUTLINE',
  'WRITING',
  'MERGING',
  'FORMATTING',
  'REVIEW',
  'REVISION',
] as const;

export type BackendTaskStage = (typeof BACKEND_TASK_STAGES)[number];

export type StageType = BackendTaskStage;
export type StageStatus = BackendTaskStatus;

export type ThesisOrderStatus =
  | 'pending_deposit'
  | 'in_progress'
  | 'pending_final_payment'
  | 'completed'
  | 'cancelled'
  | 'after_sale'
  | 'refunding'
  | 'refunded';

export type DeliverableKind = 'text' | 'file' | 'link' | 'json';

export interface Deliverable {
  id: string;
  stage: StageType;
  version: number;
  kind: DeliverableKind;
  title?: string;
  content?: string;
  url?: string;
  fileName?: string;
  fileSize?: number;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
}

export type ReviewDecision = 'approved' | 'rejected';

export interface ReviewRound {
  round: number;
  status: 'pending' | 'decided';
  decision?: ReviewDecision;
  reviewerId?: string;
  comments?: string;
  decidedAt?: string;
}

export interface OrderStage {
  type: StageType;
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  dueDate?: string;
  deliverables: Deliverable[];
  reviewRounds: ReviewRound[];
}

export interface ThesisInfo {
  schoolId?: string;
  major?: string;
  educationLevel?: string;
  title?: string;
  topic?: string;
  keywords?: string[];
  language?: string;
  wordCountTarget?: number;
  deadline?: string;
}

export interface PaymentBreakdown {
  currency: 'CNY';
  totalCents: number;
  paidCents: number;
  discountCents: number;
  refundedCents?: number;
}

export interface ThesisOrder {
  id: string;
  orderNo: string;
  status: ThesisOrderStatus;

  user: {
    id: string;
    phone: string | null;
    nickname: string | null;
    avatar?: string | null;
  };

  thesis: ThesisInfo | null;
  currentStage: StageType | null;
  dueDate: string | null;
  primaryTutorId: string | null;
  primaryTutor?: { id: string; name: string; email: string | null } | null;
  taskId: string | null;

  payment: PaymentBreakdown;

  createdAt: string;
  paidAt: string | null;
  updatedAt: string;

  stages: OrderStage[];
}
