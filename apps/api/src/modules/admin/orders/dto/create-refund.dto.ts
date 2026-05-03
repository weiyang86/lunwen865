import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class CreateRefundDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @MaxLength(200)
  reason!: string;
}
