import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @ValidateIf((o: RegisterDto) => !o.email)
  @IsOptional()
  @Matches(/^1[3-9]\d{9}$/)
  phone?: string;

  @ValidateIf((o: RegisterDto) => !o.phone)
  @IsOptional()
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  email?: string;

  @ValidateIf((o: RegisterDto) => Boolean(o.phone))
  @IsOptional()
  @IsString()
  @MinLength(6)
  code?: string;

  @ValidateIf((o: RegisterDto) => Boolean(o.email))
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  inviterCode?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(100)
  registerChannel?: string;
}
