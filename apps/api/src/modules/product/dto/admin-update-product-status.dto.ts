import { IsIn } from 'class-validator';

export class AdminUpdateProductStatusDto {
  @IsIn(['ON_SALE', 'OFF_SHELF'])
  status!: 'ON_SALE' | 'OFF_SHELF';
}
