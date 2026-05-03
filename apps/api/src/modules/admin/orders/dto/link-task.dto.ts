import { IsString } from 'class-validator';

export class LinkTaskDto {
  @IsString()
  taskId!: string;
}
