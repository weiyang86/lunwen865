import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TaskStatus } from '../constants/task-status.enum';

export class ChangeStatusDto {
  @IsIn(Object.values(TaskStatus))
  targetStatus!: TaskStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
