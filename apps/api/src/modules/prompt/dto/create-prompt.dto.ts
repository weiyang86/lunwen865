import { Type } from 'class-transformer';
import { PromptScene } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PromptVariableDto } from './prompt-variable.dto';

export class CreatePromptDto {
  @IsString()
  @Length(2, 80)
  @Matches(/^[a-z0-9._-]+$/, {
    message: 'code 只能含小写字母数字 . _ -',
  })
  code!: string;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsEnum(PromptScene)
  scene!: PromptScene;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptVariableDto)
  variables!: PromptVariableDto[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxTokens?: number;
}
