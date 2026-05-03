import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class PromptVariableDto {
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Za-z_]\w*$/)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  defaultValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
