import { TaskStatus } from '../constants/task-status.enum';

export const TRANSITION_RULES: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.DRAFT]: [TaskStatus.RUNNING, TaskStatus.CANCELLED],
  [TaskStatus.RUNNING]: [
    TaskStatus.PAUSED,
    TaskStatus.COMPLETED,
    TaskStatus.FAILED,
    TaskStatus.CANCELLED,
    TaskStatus.STALLED,
  ],
  [TaskStatus.PAUSED]: [TaskStatus.RUNNING, TaskStatus.CANCELLED],
  [TaskStatus.FAILED]: [TaskStatus.RUNNING, TaskStatus.CANCELLED],
  [TaskStatus.STALLED]: [TaskStatus.RUNNING, TaskStatus.CANCELLED],
  [TaskStatus.COMPLETED]: [],
  [TaskStatus.CANCELLED]: [],
};
