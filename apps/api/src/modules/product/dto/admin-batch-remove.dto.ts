import { IsArray, IsString } from 'class-validator';

export class AdminBatchRemoveDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}
