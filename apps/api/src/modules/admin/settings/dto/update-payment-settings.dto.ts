import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsBoolean()
  sandbox?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10080)
  orderExpireMinutes?: number;

  @IsOptional()
  @IsString()
  wechatNotifyUrl?: string;

  @IsOptional()
  @IsString()
  wechatAppid?: string;

  @IsOptional()
  @IsString()
  wechatMchid?: string;

  @IsOptional()
  @IsString()
  wechatSerialNo?: string;

  @IsOptional()
  @IsString()
  wechatPrivateKeyPath?: string;

  @IsOptional()
  @IsString()
  wechatApiV3Key?: string;

  @IsOptional()
  @IsString()
  alipayNotifyUrl?: string;

  @IsOptional()
  @IsString()
  alipayAppId?: string;

  @IsOptional()
  @IsString()
  alipayGateway?: string;

  @IsOptional()
  @IsString()
  alipayPrivateKeyPath?: string;

  @IsOptional()
  @IsString()
  alipayPublicKeyPath?: string;

  @IsOptional()
  @IsString()
  alipayReturnUrl?: string;
}
