import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ThesisExportFormat,
  ThesisExportJobStatus,
  ThesisFormatRuleType,
  ThesisFormatTemplateStatus,
  ThesisFormatTemplateType,
} from '@prisma/client';

export class ListThesisFormatTemplatesDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() collegeId?: string;
  @IsOptional() @IsString() majorId?: string;
  @IsOptional() @IsString() educationLevel?: string;
  @IsOptional() @IsString() thesisType?: string;
  @IsOptional() @IsString() stage?: string;
  @IsOptional()
  @IsEnum(ThesisFormatTemplateStatus)
  status?: ThesisFormatTemplateStatus;
  @IsOptional()
  @IsEnum(ThesisFormatTemplateType)
  templateType?: ThesisFormatTemplateType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class CreateThesisFormatTemplateDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(80) code!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() collegeId?: string;
  @IsOptional() @IsString() majorId?: string;
  @IsOptional() @IsString() @MaxLength(40) educationLevel?: string;
  @IsOptional() @IsString() @MaxLength(60) thesisType?: string;
  @IsOptional() @IsString() @MaxLength(40) stage?: string;
  @IsOptional()
  @IsEnum(ThesisFormatTemplateType)
  templateType?: ThesisFormatTemplateType;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional()
  @IsEnum(ThesisFormatTemplateStatus)
  status?: ThesisFormatTemplateStatus;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  version?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class UpdateThesisFormatTemplateDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(80) code?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() collegeId?: string;
  @IsOptional() @IsString() majorId?: string;
  @IsOptional() @IsString() @MaxLength(40) educationLevel?: string;
  @IsOptional() @IsString() @MaxLength(60) thesisType?: string;
  @IsOptional() @IsString() @MaxLength(40) stage?: string;
  @IsOptional()
  @IsEnum(ThesisFormatTemplateType)
  templateType?: ThesisFormatTemplateType;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional()
  @IsEnum(ThesisFormatTemplateStatus)
  status?: ThesisFormatTemplateStatus;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  version?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class CreateThesisFormatRuleDto {
  @IsEnum(ThesisFormatRuleType) ruleType!: ThesisFormatRuleType;
  @IsString() @MaxLength(80) ruleKey!: string;
  ruleValue!: unknown;
  @IsOptional() @IsString() description?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class UpdateThesisFormatRuleDto {
  @IsOptional() @IsEnum(ThesisFormatRuleType) ruleType?: ThesisFormatRuleType;
  @IsOptional() @IsString() @MaxLength(80) ruleKey?: string;
  @IsOptional() ruleValue?: unknown;
  @IsOptional() @IsString() description?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class GetTaskFormatTemplatesDto {
  @IsOptional() @IsString() @MaxLength(40) stage?: string;
}

export class UpdateThesisDocumentFormatSettingDto {
  @IsOptional() @IsString() templateId?: string;
  @IsOptional() overrideRules?: unknown;
  @IsOptional() @IsString() @MaxLength(2000) customRequirement?: string;
  @IsOptional() @IsString() @MaxLength(40) previewMode?: string;
}

export class ApplyFormatTemplateDto {
  @IsString() templateId!: string;
  @IsOptional() @IsBoolean() keepOverrides?: boolean;
}

export class ExportOptionsQueryDto {
  @IsOptional() @IsString() @MaxLength(40) stage?: string;
  @IsOptional() @IsEnum(ThesisExportFormat) exportFormat?: ThesisExportFormat;
}

export class CreateThesisExportJobDto {
  @IsString() documentId!: string;
  @IsString() templateId!: string;
  @IsString() @MaxLength(40) exportStage!: string;
  @IsEnum(ThesisExportFormat) exportFormat!: ThesisExportFormat;
  @IsOptional() @IsString() customRequirement?: string;
}

export class ListThesisExportJobsDto {
  @IsOptional() @IsString() taskId?: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsEnum(ThesisExportJobStatus) status?: ThesisExportJobStatus;
  @IsOptional() @IsString() exportStage?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
