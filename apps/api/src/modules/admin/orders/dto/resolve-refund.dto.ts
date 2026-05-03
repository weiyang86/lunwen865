import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveRefundDto {
  @IsIn(['APPROVED', 'REJECTED'])
  action!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  rejectReason?: string;
}
