import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateOpeningReportSectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200000)
  content!: string;
}
