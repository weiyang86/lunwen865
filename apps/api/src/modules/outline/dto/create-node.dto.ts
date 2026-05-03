import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OUTLINE_NODE_TYPES } from '../constants/node-type.constants';

const NODE_TYPE_VALUES = Object.values(OUTLINE_NODE_TYPES);

export class CreateNodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  parentId?: string;

  @IsIn(NODE_TYPE_VALUES)
  nodeType!: (typeof NODE_TYPE_VALUES)[number];

  @IsString()
  @MaxLength(80)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  orderIndex?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200000)
  expectedWords?: number;
}
