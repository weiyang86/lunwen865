import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateNotifySettingsDto {
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  smsRegion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  smsAccessKeyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  smsAccessKeySecret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  smsSignName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  smsTemplateCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  smsCodeTtlSeconds?: number;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emailHost?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  emailPort?: number;

  @IsOptional()
  @IsBoolean()
  emailSecure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emailUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emailPass?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  emailFromEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  emailFromName?: string;
}
