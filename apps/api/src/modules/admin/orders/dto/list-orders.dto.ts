import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { TaskStage } from '@prisma/client';

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'FULFILLING',
  'COMPLETED',
  'CANCELLED',
  'REFUNDING',
  'REFUNDED',
] as const;

export type OrderStatusLiteral = (typeof ORDER_STATUSES)[number];

export class ListOrdersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number = 20;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(['ALL', ...ORDER_STATUSES])
  status: 'ALL' | OrderStatusLiteral = 'ALL';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  // ORD-3: enabled (filters linked orders via Order.taskId)
  @IsOptional()
  @IsEnum(TaskStage)
  currentStage?: TaskStage;

  // ORD-5: tutor system (accepted but currently ignored)
  @IsOptional()
  @IsString()
  tutorId?: string;

  // ORD-5: enabled (filters orders by primary tutor)
  @IsOptional()
  @IsString()
  primaryTutorId?: string;

  // ORD-3: enabled (filters linked orders via Order.taskId)
  @IsOptional()
  @IsDateString()
  dueDateBefore?: string;
}
