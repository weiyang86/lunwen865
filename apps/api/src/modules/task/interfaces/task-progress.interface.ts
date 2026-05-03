import type { Task } from '@prisma/client';
import type { GenerationStage } from '../constants/generation-stage.enum';
import type { TaskStatus } from '../constants/task-status.enum';

export interface TaskProgress {
  taskId: string;
  status: TaskStatus;
  stage: GenerationStage;
  progress: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TaskDetail {
  task: Task;
  progress: TaskProgress;
}
