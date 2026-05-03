import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class BindPhoneDto {
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string;

  @IsString()
  @MinLength(6)
  code!: string;
}

export class BindEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  code!: string;
}
