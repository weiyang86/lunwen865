import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RetrySectionDto {
  @ApiPropertyOptional({
    description: '用户对上次输出的反馈，最多 500 字',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  feedback?: string;
}
