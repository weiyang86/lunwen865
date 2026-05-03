import { IsOptional, IsString } from 'class-validator';
import { QueryOrderDto } from './query-order.dto';

export class QueryAdminOrderDto extends QueryOrderDto {
  @IsOptional()
  @IsString()
  userId?: string;
}
