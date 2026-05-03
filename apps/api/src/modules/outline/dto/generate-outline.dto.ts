import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  OUTLINE_DEFAULT_MAX_DEPTH,
  OUTLINE_MAX_DEPTH_LIMIT,
} from '../constants/outline.constants';

export class GenerateOutlineDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalRequirements?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(OUTLINE_MAX_DEPTH_LIMIT)
  maxDepth: number = OUTLINE_DEFAULT_MAX_DEPTH;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(256)
  @Max(8192)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  maxRetries?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(300000)
  timeout?: number;
}
