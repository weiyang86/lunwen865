import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { WRITING_SECTION_MAX_TOKENS_DEFAULT } from '../constants/writing.constants';

export class StartWritingDto {
  @ApiPropertyOptional({ description: '温度 0-1', default: 0.7 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number;

  @ApiPropertyOptional({
    description: '单节最大 token 数',
    default: WRITING_SECTION_MAX_TOKENS_DEFAULT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(512)
  @Max(8192)
  maxTokensPerSection?: number;
}
