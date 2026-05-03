import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const TASK_STATUSES = [
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

export type BackendTaskStatus = (typeof TASK_STATUSES)[number];

export class OverrideTaskStatusDto {
  @IsIn(TASK_STATUSES)
  targetStatus!: BackendTaskStatus;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}
