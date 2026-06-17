import {
  AcademicRegionLevel,
  AcademicRegionStatus,
  AcademicStatus,
  AcademicSyncJobType,
} from '@prisma/client';
import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

function emptyToUndefined({ value }: { value: unknown }): string | undefined {
  return value === '' ? undefined : String(value);
}

export class ListAcademicDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(AcademicStatus)
  status?: AcademicStatus;

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

export class QueryCitiesDto {
  @IsString()
  provinceId!: string;
}

export class QuerySchoolsDto extends ListAcademicDto {
  @IsOptional()
  @IsString()
  provinceId?: string;

  @IsOptional()
  @IsString()
  cityId?: string;
}

export class QueryCollegesDto extends ListAcademicDto {
  @IsOptional()
  @IsString()
  schoolId?: string;
}

export class QueryMajorsDto extends ListAcademicDto {
  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsString()
  collegeId?: string;

  @IsOptional()
  @IsString()
  educationLevel?: string;
}

export class QueryLevelOnesDto {
  @IsString()
  categoryId!: string;
}

export class QueryLevelTwosDto {
  @IsString()
  levelOneId!: string;
}

export class CreateSchoolDto {
  @IsString()
  provinceId!: string;

  @IsString()
  cityId!: string;

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  schoolType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  educationLevels?: string[];

  @IsOptional()
  @IsEnum(AcademicStatus)
  status?: AcademicStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateSchoolDto extends CreateSchoolDto {
  @IsOptional()
  @IsString()
  declare provinceId: string;

  @IsOptional()
  @IsString()
  declare cityId: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  declare name: string;
}

export class CreateCollegeDto {
  @IsString()
  schoolId!: string;

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsEnum(AcademicStatus)
  status?: AcademicStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateCollegeDto extends CreateCollegeDto {
  @IsOptional()
  @IsString()
  declare schoolId: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  declare name: string;
}

export class CreateMajorDto {
  @IsString()
  schoolId!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  collegeId?: string;

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

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  educationLevel?: string;

  @IsOptional()
  @IsEnum(AcademicStatus)
  status?: AcademicStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateMajorDto extends CreateMajorDto {
  @IsOptional()
  @IsString()
  declare schoolId: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  declare name: string;
}

export class CreateDisciplineCategoryDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(50)
  code!: string;

  @IsOptional()
  @IsEnum(AcademicStatus)
  status?: AcademicStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateDisciplineCategoryDto extends CreateDisciplineCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare code: string;
}

export class CreateDisciplineLevelOneDto {
  @IsString()
  categoryId!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(50)
  code!: string;

  @IsOptional()
  @IsEnum(AcademicStatus)
  status?: AcademicStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateDisciplineLevelOneDto extends CreateDisciplineLevelOneDto {
  @IsOptional()
  @IsString()
  declare categoryId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare code: string;
}

export class CreateDisciplineLevelTwoDto {
  @IsString()
  levelOneId!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(50)
  code!: string;

  @IsOptional()
  @IsEnum(AcademicStatus)
  status?: AcademicStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateDisciplineLevelTwoDto extends CreateDisciplineLevelTwoDto {
  @IsOptional()
  @IsString()
  declare levelOneId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare code: string;
}

export class ListRegionsDto {
  @IsOptional()
  @IsString()
  keyword?: string;
  @IsOptional()
  @IsEnum(AcademicRegionLevel)
  level?: AcademicRegionLevel;

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsOptional()
  @IsEnum(AcademicRegionStatus)
  status?: AcademicRegionStatus;

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

export class ListSyncLogsDto {
  @IsOptional()
  @IsEnum(AcademicSyncJobType)
  jobType?: AcademicSyncJobType;

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
