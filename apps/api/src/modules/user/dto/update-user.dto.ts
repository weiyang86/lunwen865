import { EducationLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nickname?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  realName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  school?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  major?: string;

  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @IsOptional()
  @IsString()
  grade?: string;
}
