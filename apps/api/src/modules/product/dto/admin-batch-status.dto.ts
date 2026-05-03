import { IsArray, IsIn, IsString } from 'class-validator';

export class AdminBatchStatusDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsIn(['ON_SALE', 'OFF_SHELF'])
  status!: 'ON_SALE' | 'OFF_SHELF';
}
