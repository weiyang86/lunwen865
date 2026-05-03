import { Type } from 'class-transformer';
import {
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

export class GenerateTopicDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(TOPIC_MIN_COUNT)
  @Max(TOPIC_MAX_COUNT)
  count: number = DEFAULT_TOPIC_COUNT;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  additionalContext?: string;

  @IsOptional()
  @IsString()
  preferredStyle?: string;
}
