import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PolishMode, PolishStrength } from '@prisma/client';

export class CreatePolishDto {
  @IsString({ message: '文本必须是字符串' })
  @MinLength(50, { message: '文本至少 50 字' })
  @MaxLength(20000, { message: '文本不能超过 20000 字' })
  text!: string;

  @IsEnum(PolishStrength, { message: '降AI强度无效' })
  strength!: PolishStrength;

  @IsEnum(PolishMode, { message: '处理模式无效' })
  @IsOptional()
  mode?: PolishMode;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  title?: string;

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsBoolean()
  @IsOptional()
  preserveQuotes?: boolean;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsOptional()
  preserveTerms?: string[];
}
