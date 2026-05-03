import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import {
  LoginType,
  QuotaChangeReason,
  QuotaType,
  UserStatus,
  VerifyScene,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { User } from '@prisma/client';
import { UserService } from '../user/user.service';
import { QuotaService } from '../quota/quota.service';
import { SmsService } from './sms/sms.service';
import type {
  AuthResult,
  ReqContext,
  SafeUser,
} from './interfaces/auth-result.interface';
import type {
  LoginEmailDto,
  LoginPhoneCodeDto,
  LoginPhonePasswordDto,
} from './dto/login.dto';
import type { RefreshTokenDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResetPasswordDto, ChangePasswordDto } from './dto/password.dto';
import type { SendCodeDto } from './dto/send-code.dto';

const SAFE_USER_SELECT = {
  id: true,
  phone: true,
  email: true,
  nickname: true,
  avatar: true,
  realName: true,
  school: true,
  major: true,
  educationLevel: true,
  grade: true,
  role: true,
  status: true,
  banReason: true,
  bannedUntil: true,
  totalWordsQuota: true,
  usedWords: true,
  registerChannel: true,
  inviterId: true,
  lastLoginAt: true,
  lastLoginIp: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractJwtExpSeconds(tokenPayload: unknown): number | null {
  if (!isRecord(tokenPayload)) return null;
  const exp = tokenPayload['exp'];
  if (typeof exp !== 'number') return null;
  return exp;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly quotaService: QuotaService,
  ) {}

  async sendCode(dto: SendCodeDto): Promise<void> {
    const now = Date.now();
    const last = await this.prisma.verifyCode.findFirst({
      where: { target: dto.target, scene: dto.scene },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (last) {
      const diffMs = now - last.createdAt.getTime();
      if (diffMs < 60_000) {
        throw new HttpException(
          '验证码发送过于频繁，请稍后再试',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(now + 5 * 60_000);

    await this.prisma.verifyCode.create({
      data: { target: dto.target, scene: dto.scene, code, expiresAt },
      select: { id: true },
    });

    if (dto.type === 'phone') {
      await this.smsService.sendCode(dto.target, code, dto.scene);
      return;
    }

    console.log(
      `\n[Mock Email] 📧 ${dto.target} 验证码: ${code} (scene=${dto.scene})\n`,
    );
  }

  async register(dto: RegisterDto, ctx: ReqContext): Promise<AuthResult> {
    if (dto.phone && dto.email) {
      throw new BadRequestException('手机号注册与邮箱注册不可同时提交');
    }
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('请提供手机号或邮箱');
    }

    let inviterId: string | undefined;
    if (dto.inviterCode) {
      const inviter = await this.prisma.user.findFirst({
        where: { id: { endsWith: dto.inviterCode } },
        select: { id: true },
      });
      if (!inviter) throw new BadRequestException('邀请码无效');
      inviterId = inviter.id;
    }

    if (dto.phone) {
      if (!dto.code) throw new BadRequestException('手机号注册需要验证码');
      await this.verifyCode(dto.phone, dto.code, VerifyScene.REGISTER);

      const existing = await this.userService.findByPhone(dto.phone);
      if (existing) throw new ConflictException('手机号已注册');

      const nickname = dto.nickname ?? `用户_${dto.phone.slice(-4)}`;
      const user = await this.userService.create({
        phone: dto.phone,
        nickname,
        registerChannel: dto.registerChannel,
        inviter: inviterId ? { connect: { id: inviterId } } : undefined,
      });

      await this.grantRegisterGift(user.id);
      return this.generateTokens(this.userService.toSafeUser(user), ctx);
    }

    if (!dto.password) throw new BadRequestException('邮箱注册需要密码');
    if (!dto.email) throw new BadRequestException('请提供邮箱');
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) throw new ConflictException('邮箱已注册');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.userService.create({
      email: dto.email,
      password: hashed,
      nickname: dto.nickname ?? undefined,
      registerChannel: dto.registerChannel,
      inviter: inviterId ? { connect: { id: inviterId } } : undefined,
    });

    await this.grantRegisterGift(user.id);
    return this.generateTokens(this.userService.toSafeUser(user), ctx);
  }

  async loginByPhoneCode(
    dto: LoginPhoneCodeDto,
    ctx: ReqContext,
  ): Promise<AuthResult> {
    await this.verifyCode(dto.phone, dto.code, VerifyScene.LOGIN);

    let user = await this.userService.findByPhone(dto.phone);

    if (!user) {
      user = await this.userService.create({
        phone: dto.phone,
        nickname: `用户_${dto.phone.slice(-4)}`,
      });

      await this.grantRegisterGift(user.id);
    }

    this.assertUserActive(user);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ctx.ip ?? undefined },
    });
    const safeUser = this.userService.toSafeUser(updated);

    await this.logLogin({
      userId: safeUser.id,
      loginType: LoginType.PHONE_CODE,
      identifier: dto.phone,
      success: true,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.generateTokens(safeUser, ctx);
  }

  private async grantRegisterGift(userId: string): Promise<void> {
    const paper = this.configService.get<number>(
      'payment.registerGift.paperGeneration',
      1,
    );
    const polish = this.configService.get<number>(
      'payment.registerGift.polish',
      2,
    );
    const exp = this.configService.get<number>(
      'payment.registerGift.export',
      1,
    );

    if (paper > 0) {
      await this.quotaService.grant({
        userId,
        type: QuotaType.PAPER_GENERATION,
        amount: paper,
        reason: QuotaChangeReason.REGISTER_GIFT,
        remark: '新用户注册赠送',
      });
    }
    if (polish > 0) {
      await this.quotaService.grant({
        userId,
        type: QuotaType.POLISH,
        amount: polish,
        reason: QuotaChangeReason.REGISTER_GIFT,
      });
    }
    if (exp > 0) {
      await this.quotaService.grant({
        userId,
        type: QuotaType.EXPORT,
        amount: exp,
        reason: QuotaChangeReason.REGISTER_GIFT,
      });
    }
  }

  async loginByPhonePassword(
    dto: LoginPhonePasswordDto,
    ctx: ReqContext,
  ): Promise<AuthResult> {
    await this.checkLoginLock(dto.phone);

    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { ...SAFE_USER_SELECT, password: true },
    });

    if (!user || !user.password) {
      await this.logLogin({
        userId: user?.id,
        loginType: LoginType.PHONE_PASSWORD,
        identifier: dto.phone,
        success: false,
        failReason: '账号或密码错误',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('账号或密码错误');
    }

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      await this.logLogin({
        userId: user.id,
        loginType: LoginType.PHONE_PASSWORD,
        identifier: dto.phone,
        success: false,
        failReason: '账号或密码错误',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('账号或密码错误');
    }

    this.assertUserActive(user);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ctx.ip ?? undefined },
      select: SAFE_USER_SELECT,
    });

    await this.logLogin({
      userId: updated.id,
      loginType: LoginType.PHONE_PASSWORD,
      identifier: dto.phone,
      success: true,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.generateTokens(updated, ctx);
  }

  async loginByEmail(dto: LoginEmailDto, ctx: ReqContext): Promise<AuthResult> {
    await this.checkLoginLock(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...SAFE_USER_SELECT, password: true },
    });

    if (!user || !user.password) {
      await this.logLogin({
        userId: user?.id,
        loginType: LoginType.EMAIL_PASSWORD,
        identifier: dto.email,
        success: false,
        failReason: '账号或密码错误',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('账号或密码错误');
    }

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      await this.logLogin({
        userId: user.id,
        loginType: LoginType.EMAIL_PASSWORD,
        identifier: dto.email,
        success: false,
        failReason: '账号或密码错误',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('账号或密码错误');
    }

    this.assertUserActive(user);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ctx.ip ?? undefined },
      select: SAFE_USER_SELECT,
    });

    await this.logLogin({
      userId: updated.id,
      loginType: LoginType.EMAIL_PASSWORD,
      identifier: dto.email,
      success: true,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.generateTokens(updated, ctx);
  }

  async loginByWechat(code: string, ctx: ReqContext): Promise<AuthResult> {
    if (!code) throw new BadRequestException('code 不能为空');

    const openId = `mock_${code}`;
    let user = await this.prisma.user.findUnique({
      where: { wechatOpenId: openId },
      select: SAFE_USER_SELECT,
    });

    if (!user) {
      const suffix = openId.slice(-4);
      user = await this.prisma.user.create({
        data: { wechatOpenId: openId, nickname: `微信用户_${suffix}` },
        select: SAFE_USER_SELECT,
      });
    }

    this.assertUserActive(user);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ctx.ip ?? undefined },
      select: SAFE_USER_SELECT,
    });

    await this.logLogin({
      userId: updated.id,
      loginType: LoginType.WECHAT,
      identifier: openId,
      success: true,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.generateTokens(updated, ctx);
  }

  async refresh(dto: RefreshTokenDto, ctx: ReqContext): Promise<AuthResult> {
    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      '',
    );
    let payload: unknown;
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('refreshToken 无效');
    }

    if (!isRecord(payload) || typeof payload['sub'] !== 'string') {
      throw new UnauthorizedException('refreshToken 无效');
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      select: { id: true, userId: true, revoked: true, expiresAt: true },
    });

    if (!record || record.revoked || record.expiresAt <= new Date()) {
      throw new UnauthorizedException('refreshToken 已失效');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new UnauthorizedException('用户不存在');

    this.assertUserActive(user);

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked: true, revokedAt: new Date() },
      select: { id: true },
    });

    return this.generateTokens(user, ctx);
  }

  async logout(refreshToken: string): Promise<void> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      select: { id: true, revoked: true },
    });
    if (!record || record.revoked) return;

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked: true, revokedAt: new Date() },
      select: { id: true },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    await this.verifyCode(dto.target, dto.code, VerifyScene.RESET_PASSWORD);

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ phone: dto.target }, { email: dto.target }] },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
      select: { id: true },
    });

    await this.logoutAll(user.id);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    if (!user.password) throw new BadRequestException('当前账号未设置密码');

    const ok = await bcrypt.compare(dto.oldPassword, user.password);
    if (!ok) throw new UnauthorizedException('旧密码错误');

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
      select: { id: true },
    });
  }

  async getMe(userId: string): Promise<{
    id: string;
    email: string | null;
    role: User['role'];
    name: string | null;
    avatar: string | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        nickname: true,
        avatar: true,
        status: true,
        bannedUntil: true,
      },
    });
    if (!user) throw new UnauthorizedException('用户不存在');
    this.assertUserActive(user);
    return {
      id: user.id,
      email: user.email ?? null,
      role: user.role,
      name: user.nickname ?? null,
      avatar: user.avatar ?? null,
    };
  }

  private assertUserActive(user: Pick<User, 'status' | 'bannedUntil'>): void {
    const now = new Date();
    if (user.status === UserStatus.BANNED) {
      if (!user.bannedUntil || user.bannedUntil > now) {
        throw new ForbiddenException('账号已被封禁');
      }
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('账号不可用');
    }
  }

  async verifyCode(
    target: string,
    code: string,
    scene: VerifyScene,
  ): Promise<void> {
    const record = await this.prisma.verifyCode.findFirst({
      where: { target, scene, used: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, attemptCount: true, expiresAt: true },
    });
    if (!record) throw new BadRequestException('验证码不存在');

    const now = new Date();
    if (record.expiresAt <= now) throw new BadRequestException('验证码已过期');
    if (record.attemptCount >= 5) {
      throw new ForbiddenException('验证码尝试次数过多，请重新获取');
    }

    if (record.code !== code) {
      await this.prisma.verifyCode.update({
        where: { id: record.id },
        data: { attemptCount: { increment: 1 } },
        select: { id: true },
      });
      throw new BadRequestException('验证码错误');
    }

    await this.prisma.verifyCode.update({
      where: { id: record.id },
      data: {
        used: true,
        usedAt: now,
        attemptCount: { increment: 1 },
      },
      select: { id: true },
    });
  }

  private async generateTokens(
    user: SafeUser,
    ctx: ReqContext,
  ): Promise<AuthResult> {
    const accessSecret = this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      '',
    );
    const accessExpiresIn = this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '2h',
    ) as JwtSignOptions['expiresIn'];
    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      '',
    );
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    ) as JwtSignOptions['expiresIn'];

    const payload = {
      sub: user.id,
      role: user.role,
      phone: user.phone ?? undefined,
    };

    const accessToken = await this.jwtService.signAsync(
      { ...payload, jti: crypto.randomUUID() },
      {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, jti: crypto.randomUUID() },
      {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      },
    );

    const refreshExp = extractJwtExpSeconds(
      this.jwtService.decode(refreshToken),
    );
    if (!refreshExp) {
      throw new BadRequestException('refreshToken 生成失败');
    }

    const accessExp = extractJwtExpSeconds(this.jwtService.decode(accessToken));
    const expiresIn = accessExp
      ? Math.max(accessExp - Math.floor(Date.now() / 1000), 0)
      : 0;

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(refreshExp * 1000),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      select: { id: true },
    });

    return { user, accessToken, refreshToken, expiresIn };
  }

  private async checkLoginLock(identifier: string): Promise<void> {
    const masked = identifier.includes('@')
      ? this.maskEmail(identifier)
      : this.maskPhone(identifier);
    const since = new Date(Date.now() - 30 * 60_000);
    const failedCount = await this.prisma.loginLog.count({
      where: { identifier: masked, success: false, createdAt: { gte: since } },
    });
    if (failedCount >= 5) {
      throw new ForbiddenException('登录失败次数过多，请稍后再试');
    }
  }

  private async logLogin(data: {
    userId?: string;
    loginType: LoginType;
    identifier: string;
    success: boolean;
    failReason?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const masked = data.identifier.includes('@')
      ? this.maskEmail(data.identifier)
      : /^\d{11}$/.test(data.identifier)
        ? this.maskPhone(data.identifier)
        : data.identifier;

    await this.prisma.loginLog.create({
      data: {
        userId: data.userId,
        loginType: data.loginType,
        identifier: masked,
        success: data.success,
        failReason: data.failReason,
        ip: data.ip,
        userAgent: data.userAgent,
      },
      select: { id: true },
    });
  }

  private maskPhone(phone: string): string {
    if (!/^1[3-9]\d{9}$/.test(phone)) return phone;
    return `${phone.slice(0, 3)}****${phone.slice(7)}`;
  }

  private maskEmail(email: string): string {
    const at = email.indexOf('@');
    if (at <= 0) return email;
    const name = email.slice(0, at);
    const domain = email.slice(at + 1);
    const prefix = name.slice(0, Math.min(2, name.length));
    return `${prefix}****@${domain}`;
  }
}
