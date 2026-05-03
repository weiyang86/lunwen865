import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { ReqContext } from './interfaces/auth-result.interface';
import { SendCodeDto } from './dto/send-code.dto';
import { RegisterDto } from './dto/register.dto';
import {
  LoginEmailDto,
  LoginPhoneCodeDto,
  LoginPhonePasswordDto,
  RefreshTokenDto,
} from './dto/login.dto';
import { ChangePasswordDto, ResetPasswordDto } from './dto/password.dto';
import { IsString } from 'class-validator';

class LoginWechatBodyDto {
  @IsString()
  code!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private buildCtx(req: Request): ReqContext {
    const userAgentHeader = req.headers['user-agent'];
    const userAgent =
      typeof userAgentHeader === 'string' ? userAgentHeader : undefined;
    return { ip: req.ip, userAgent };
  }

  @Public()
  @Post('send-code')
  async sendCode(@Body() dto: SendCodeDto): Promise<{ ok: true }> {
    await this.authService.sendCode(dto);
    return { ok: true };
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.buildCtx(req));
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginEmailDto, @Req() req: Request) {
    const r = await this.authService.loginByEmail(dto, this.buildCtx(req));
    return { token: r.accessToken, user: r.user };
  }

  @Public()
  @Post('login/phone-code')
  loginByPhoneCode(@Body() dto: LoginPhoneCodeDto, @Req() req: Request) {
    return this.authService.loginByPhoneCode(dto, this.buildCtx(req));
  }

  @Public()
  @Post('login/phone-password')
  loginByPhonePassword(
    @Body() dto: LoginPhonePasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.loginByPhonePassword(dto, this.buildCtx(req));
  }

  @Public()
  @Post('login/email')
  loginByEmail(@Body() dto: LoginEmailDto, @Req() req: Request) {
    return this.authService.loginByEmail(dto, this.buildCtx(req));
  }

  @Public()
  @Post('login/wechat')
  loginByWechat(@Body() body: LoginWechatBodyDto, @Req() req: Request) {
    return this.authService.loginByWechat(body.code, this.buildCtx(req));
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto, this.buildCtx(req));
  }

  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto): Promise<{ ok: true }> {
    await this.authService.logout(dto.refreshToken);
    return { ok: true };
  }

  @Post('logout-all')
  async logoutAll(@CurrentUser('id') userId: string): Promise<{ ok: true }> {
    await this.authService.logoutAll(userId);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    await this.authService.resetPassword(dto);
    return { ok: true };
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    await this.authService.changePassword(userId, dto);
    return { ok: true };
  }
}
