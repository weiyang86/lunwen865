import { IsIn } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn(['FULFILLING', 'COMPLETED', 'CANCELLED'])
  status!: 'FULFILLING' | 'COMPLETED' | 'CANCELLED';
}
