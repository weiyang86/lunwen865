import { Type } from 'class-transformer';
import { IsEnum, IsInt, Min } from 'class-validator';
import { QuotaType } from '@prisma/client';

export class ExchangeQuotaDto {
  @IsEnum(QuotaType)
  targetType!: QuotaType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;
}
