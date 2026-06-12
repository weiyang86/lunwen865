import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateDocxDto {
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;

  @IsOptional()
  @IsString()
  templateId?: string;
}
