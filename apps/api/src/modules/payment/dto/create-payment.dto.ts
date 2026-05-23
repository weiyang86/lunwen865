import { IsIn, IsString } from 'class-validator';

const CHANNELS = ['mock', 'wechat', 'alipay'] as const;
const METHODS = ['mock', 'native', 'h5', 'page', 'wap'] as const;

export class CreatePaymentDto {
  @IsString()
  orderId: string;

  @IsString()
  @IsIn(CHANNELS)
  channel: (typeof CHANNELS)[number];

  @IsString()
  @IsIn(METHODS)
  method: (typeof METHODS)[number];
}
