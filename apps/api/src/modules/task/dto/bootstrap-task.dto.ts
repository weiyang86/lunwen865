import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BootstrapTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  schoolId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  major?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  educationLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  topic?: string;
}
