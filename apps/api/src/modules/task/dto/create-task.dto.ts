import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  schoolId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  major!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  educationLevel!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  topic!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  language?: string = 'zh-CN';

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(3000)
  @Max(100000)
  wordCountTarget?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}
