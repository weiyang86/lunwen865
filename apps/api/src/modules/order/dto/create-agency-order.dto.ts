import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAgencyOrderDto {
  @IsOptional()
  @IsString()
  agencyId?: string;

  @IsString()
  userId: string;

  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
