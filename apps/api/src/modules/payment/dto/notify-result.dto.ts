import { IsOptional, IsString } from 'class-validator';

export class NotifyResultDto {
  @IsString()
  code: 'SUCCESS' | 'FAIL';

  @IsOptional()
  @IsString()
  message?: string;
}
