import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateSectionDto {
  @ApiProperty({ description: '编辑后的全文内容', maxLength: 20000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  content!: string;
}
