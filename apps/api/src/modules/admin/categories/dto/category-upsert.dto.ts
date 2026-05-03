import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CategoryUpsertDto {
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  name!: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;
}
