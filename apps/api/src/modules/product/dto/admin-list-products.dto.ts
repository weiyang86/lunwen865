import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AdminListProductsDto {
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
  categoryId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeSubCategory: boolean = true;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(['ALL', 'ON_SALE', 'OFF_SHELF', 'DRAFT'])
  status: 'ALL' | 'ON_SALE' | 'OFF_SHELF' | 'DRAFT' = 'ALL';
}
