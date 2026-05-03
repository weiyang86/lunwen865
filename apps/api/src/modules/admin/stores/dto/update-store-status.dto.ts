import { IsIn } from 'class-validator';

export class UpdateStoreStatusDto {
  @IsIn(['OPEN', 'PAUSED'])
  status!: 'OPEN' | 'PAUSED';
}
