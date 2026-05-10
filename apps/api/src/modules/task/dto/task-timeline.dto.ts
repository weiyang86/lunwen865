import { TaskStage, TaskStatus } from '@prisma/client';

export type TaskTimelineEventType =
  | 'TASK_CREATED'
  | 'STATUS_CHANGED'
  | 'STAGE_CHANGED'
  | 'ADMIN_ACTION'
  | 'ORDER_LINKED'
  | 'UPDATED';

export interface TaskTimelineItemDto {
  id: string;
  type: TaskTimelineEventType;
  title: string;
  description: string;
  createdAt: Date;
  status?: TaskStatus | null;
  stage?: TaskStage | null;
  operatorId?: string | null;
  orderId?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface TaskTimelineDto {
  taskId: string;
  currentStatus: TaskStatus;
  currentStage: TaskStage | null;
  updatedAt: Date;
  items: TaskTimelineItemDto[];
}
