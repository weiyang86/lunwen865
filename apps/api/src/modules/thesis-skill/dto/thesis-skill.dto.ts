import {
  ThesisSkillCategory,
  ThesisSkillRunStatus,
  ThesisSkillStage,
  ThesisSkillStatus,
} from '@prisma/client';
import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

function emptyToUndefined({ value }: { value: unknown }): string | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  return typeof value === 'string' ? value : undefined;
}

export class ListThesisSkillsDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(ThesisSkillStage)
  stage?: ThesisSkillStage;

  @IsOptional()
  @IsEnum(ThesisSkillStatus)
  status?: ThesisSkillStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}

export class CreateThesisSkillDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(80)
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ThesisSkillStage)
  stage!: ThesisSkillStage;

  @IsEnum(ThesisSkillCategory)
  category!: ThesisSkillCategory;

  @IsOptional()
  @IsEnum(ThesisSkillStatus)
  status?: ThesisSkillStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateThesisSkillDto extends CreateThesisSkillDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  declare code: string;

  @IsOptional()
  @IsEnum(ThesisSkillStage)
  declare stage: ThesisSkillStage;

  @IsOptional()
  @IsEnum(ThesisSkillCategory)
  declare category: ThesisSkillCategory;
}

export class CreateThesisSkillVersionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @IsString()
  promptTemplate!: string;

  @IsObject()
  inputSchema!: Record<string, unknown>;

  @IsObject()
  outputSchema!: Record<string, unknown>;

  @IsObject()
  qualityRules!: Record<string, unknown>;

  @IsObject()
  modelConfig!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  changeLog?: string;
}

export class UpdateThesisSkillVersionDto extends CreateThesisSkillVersionDto {
  @IsOptional()
  @IsString()
  declare promptTemplate: string;

  @IsOptional()
  @IsObject()
  declare inputSchema: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  declare outputSchema: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  declare qualityRules: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  declare modelConfig: Record<string, unknown>;
}

export class CreateThesisSkillBindingDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  skillVersionId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  educationLevel?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  thesisType?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  disciplineCategoryId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  disciplineLevelOneId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  disciplineLevelTwoId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  schoolId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  majorId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsEnum(ThesisSkillStatus)
  status?: ThesisSkillStatus;
}

export class UpdateThesisSkillBindingDto extends CreateThesisSkillBindingDto {}

export class TestRunThesisSkillDto {
  @IsOptional()
  @IsObject()
  inputPayload?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(ThesisSkillStage)
  stage?: ThesisSkillStage;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  educationLevel?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  thesisType?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  schoolId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  majorId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  disciplineCategoryId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  disciplineLevelOneId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  disciplineLevelTwoId?: string;
}

export class ListThesisSkillRunsDto {
  @IsOptional()
  @IsString()
  skillId?: string;

  @IsOptional()
  @IsEnum(ThesisSkillStage)
  stage?: ThesisSkillStage;

  @IsOptional()
  @IsEnum(ThesisSkillRunStatus)
  status?: ThesisSkillRunStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}
