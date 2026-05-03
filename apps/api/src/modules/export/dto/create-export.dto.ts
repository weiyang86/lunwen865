import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ExportFormat, ExportScope, ExportTemplate } from '@prisma/client';

export class CreateExportDto {
  @IsEnum(ExportFormat)
  @IsOptional()
  format?: ExportFormat;

  @IsEnum(ExportScope)
  scope: ExportScope;

  @IsEnum(ExportTemplate)
  @IsOptional()
  template?: ExportTemplate;

  @IsString()
  @IsOptional()
  paperId?: string;

  @IsString()
  @IsOptional()
  polishTaskId?: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  author?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  school?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  major?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  studentId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  advisor?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  abstract?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  keywords?: string[];
}
