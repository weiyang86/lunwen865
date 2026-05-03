import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DEFAULT_TOPIC_COUNT,
  TOPIC_MAX_COUNT,
  TOPIC_MIN_COUNT,
} from '../constants/topic.constants';

export class RegenerateTopicDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(TOPIC_MIN_COUNT)
  @Max(TOPIC_MAX_COUNT)
  count: number = DEFAULT_TOPIC_COUNT;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  rejectedTitles?: string[];

  @IsOptional()
  @IsString()
  preferredStyle?: string;
}
