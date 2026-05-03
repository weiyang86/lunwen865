import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class MoveNodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  newParentId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  newOrderIndex!: number;
}
