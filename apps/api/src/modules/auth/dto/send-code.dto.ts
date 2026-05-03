import { VerifyScene } from '@prisma/client';
import { IsEnum, IsIn, IsString } from 'class-validator';

export class SendCodeDto {
  @IsString()
  target!: string;

  @IsIn(['phone', 'email'])
  type!: 'phone' | 'email';

  @IsEnum(VerifyScene)
  scene!: VerifyScene;
}
