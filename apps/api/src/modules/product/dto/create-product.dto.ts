import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_]+$/, { message: 'code 只能包含英文、数字、下划线' })
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  priceCents: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  originalPriceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paperQuota?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  polishQuota?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  exportQuota?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  aiChatQuota?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
