import { IsArray, IsOptional, IsString } from 'class-validator';

export class CategoryReorderDto {
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}
