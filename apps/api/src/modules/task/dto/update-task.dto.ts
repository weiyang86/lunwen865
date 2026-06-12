import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TaskAcademicContextDto } from './task-academic-context.dto';

export class UpdateTaskDto extends TaskAcademicContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  topic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  educationLevel?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(3000)
  @Max(100000)
  wordCountTarget?: number;
}
