import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAbstractDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  abstractZh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  abstractEn?: string;
}
