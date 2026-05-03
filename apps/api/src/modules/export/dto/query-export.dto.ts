import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ExportStatus, ExportTemplate } from '@prisma/client';

export class QueryExportDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsEnum(ExportStatus)
  status?: ExportStatus;

  @IsOptional()
  @IsEnum(ExportTemplate)
  template?: ExportTemplate;
}
