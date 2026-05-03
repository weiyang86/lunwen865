import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentChannel, PaymentMethod } from '@prisma/client';

export class PrepayDto {
  @IsString()
  orderId: string;

  @IsEnum(PaymentChannel)
  channel: PaymentChannel;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
