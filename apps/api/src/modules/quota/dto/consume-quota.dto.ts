import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { QuotaType } from '@prisma/client';

export class ConsumeQuotaDto {
  @IsEnum(QuotaType)
  type: QuotaType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  bizId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
