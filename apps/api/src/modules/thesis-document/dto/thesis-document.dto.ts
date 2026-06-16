import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ThesisAdvisorCommentStatus,
  ThesisDocumentMergeMode,
  ThesisDocumentSectionType,
  ThesisDocumentStatus,
} from '@prisma/client';

export class UpdateThesisDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  abstract?: string;

  @IsOptional()
  keywords?: unknown;

  @IsOptional()
  @IsEnum(ThesisDocumentStatus)
  status?: ThesisDocumentStatus;
}

export class CreateDocumentSectionDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsEnum(ThesisDocumentSectionType)
  sectionType?: ThesisDocumentSectionType;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  level?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sourceStage?: string;

  @IsOptional()
  @IsString()
  sourceGenerationRunId?: string;
}

export class UpdateDocumentSectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(ThesisDocumentSectionType)
  sectionType?: ThesisDocumentSectionType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  level?: number;
}

export class MergeStageContentDto {
  @IsString()
  @MaxLength(40)
  stage!: string;

  @IsOptional()
  @IsString()
  generationRunId?: string;

  @IsOptional()
  @IsEnum(ThesisDocumentMergeMode)
  mode?: ThesisDocumentMergeMode;

  @IsOptional()
  @IsString()
  sectionId?: string;
}

export class QueryRevisionsDto {
  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

export class CreateAdvisorCommentDto {
  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  commentText!: string;
}

export class UpdateAdvisorCommentDto {
  @IsOptional()
  @IsString()
  commentText?: string;

  @IsOptional()
  @IsEnum(ThesisAdvisorCommentStatus)
  status?: ThesisAdvisorCommentStatus;
}
