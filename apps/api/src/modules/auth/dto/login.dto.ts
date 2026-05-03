import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginPhoneCodeDto {
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string;

  @IsString()
  @MinLength(6)
  code!: string;
}

export class LoginPhonePasswordDto {
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  password!: string;
}

export class LoginEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
