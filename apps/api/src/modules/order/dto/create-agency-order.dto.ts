import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAgencyOrderDto {
  @IsString()
  userId: string;

  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
