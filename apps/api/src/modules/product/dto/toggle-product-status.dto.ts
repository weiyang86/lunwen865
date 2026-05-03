import { IsEnum } from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class ToggleProductStatusDto {
  @IsEnum(ProductStatus)
  status: ProductStatus;
}
