import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const TASK_STAGES = [
  'TOPIC',
  'OPENING',
  'OUTLINE',
  'WRITING',
  'MERGING',
  'FORMATTING',
  'REVIEW',
  'REVISION',
] as const;

export type BackendTaskStage = (typeof TASK_STAGES)[number];

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

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

export class ListAdminTasksDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(TASK_STAGES)
  currentStage?: BackendTaskStage;

  @IsOptional()
  @IsIn(TASK_STATUSES, { each: true })
  statuses?: BackendTaskStatus[];

  @IsOptional()
  @IsString()
  orderNo?: string;

  @IsOptional()
  @IsDateString()
  createdAtStart?: string;

  @IsOptional()
  @IsDateString()
  createdAtEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt'])
  sortBy?: 'createdAt' | 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  linkedOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  unlinkedOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;
}
