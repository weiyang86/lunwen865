import { Type } from 'class-transformer';
import { RefSource, RefType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateReferenceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  index?: number;

  @IsOptional()
  @IsEnum(RefType)
  type?: RefType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  authors?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  journal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  volume?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  issue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  pages?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  publisher?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  university?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  degree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @IsDateString()
  accessDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  doi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  isbn?: string;

  @IsOptional()
  @IsEnum(RefSource)
  source?: RefSource;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}
