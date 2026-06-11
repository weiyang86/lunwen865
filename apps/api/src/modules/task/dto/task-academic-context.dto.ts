import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TaskAcademicContextDto {
  @IsOptional()
  @IsString()
  provinceId?: string;

  @IsOptional()
  @IsString()
  cityId?: string;

  /** Academic-01 高校 ID；为避免与 legacy School.schoolId 冲突，入参使用 academicSchoolId。 */
  @IsOptional()
  @IsString()
  academicSchoolId?: string;

  @IsOptional()
  @IsString()
  collegeId?: string;

  @IsOptional()
  @IsString()
  majorId?: string;

  @IsOptional()
  @IsString()
  disciplineCategoryId?: string;

  @IsOptional()
  @IsString()
  disciplineLevelOneId?: string;

  @IsOptional()
  @IsString()
  disciplineLevelTwoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  thesisType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  researchDirection?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  advisorRequirement?: string;

  @IsOptional()
  @IsString()
  formatTemplateId?: string;
}
