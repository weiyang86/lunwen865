import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
