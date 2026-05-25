import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const TOPIC_CHANGE_TYPES = ['MENTOR', 'SELF'] as const;
export type TopicChangeType = (typeof TOPIC_CHANGE_TYPES)[number];

export class EditTopicCandidateDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsIn(TOPIC_CHANGE_TYPES)
  type?: TopicChangeType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
