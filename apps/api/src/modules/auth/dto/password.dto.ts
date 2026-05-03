import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  target!: string;

  @IsString()
  @MinLength(6)
  code!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  newPassword!: string;
}
