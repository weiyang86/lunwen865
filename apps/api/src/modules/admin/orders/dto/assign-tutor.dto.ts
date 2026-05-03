import { IsString } from 'class-validator';

export class AssignTutorDto {
  @IsString()
  primaryTutorId!: string;
}
