import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject, forwardRef } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { VerifyScene } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SafeUser } from '../auth/interfaces/auth-result.interface';
import { AuthService } from '../auth/auth.service';
import type { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByWechatOpenId(openId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { wechatOpenId: openId } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    return this.toSafeUser(user);
  }

  async bindPhone(id: string, phone: string, code: string): Promise<SafeUser> {
    await this.authService.verifyCode(phone, code, VerifyScene.BIND_PHONE);

    const exists = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (exists && exists.id !== id)
      throw new ConflictException('手机号已被占用');

    const user = await this.prisma.user.update({
      where: { id },
      data: { phone },
    });
    return this.toSafeUser(user);
  }

  async bindEmail(id: string, email: string, code: string): Promise<SafeUser> {
    await this.authService.verifyCode(email, code, VerifyScene.BIND_EMAIL);

    const exists = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (exists && exists.id !== id) throw new ConflictException('邮箱已被占用');

    const user = await this.prisma.user.update({
      where: { id },
      data: { email },
    });
    return this.toSafeUser(user);
  }

  async findMyLoginLogs(
    userId: string,
    limit: number = 20,
  ): Promise<
    Array<{
      createdAt: Date;
      loginType: string;
      identifier: string;
      success: boolean;
      failReason: string | null;
      ip: string | null;
      userAgent: string | null;
    }>
  > {
    return this.prisma.loginLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        createdAt: true,
        loginType: true,
        identifier: true,
        success: true,
        failReason: true,
        ip: true,
        userAgent: true,
      },
    });
  }

  async getMyQuota(
    userId: string,
  ): Promise<{ total: number; used: number; remaining: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalWordsQuota: true, usedWords: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    const total = user.totalWordsQuota ?? 0;
    const used = user.usedWords ?? 0;
    return { total, used, remaining: Math.max(total - used, 0) };
  }

  async checkQuota(userId: string, words: number): Promise<boolean> {
    const safeWords = Math.floor(words);
    if (!Number.isFinite(safeWords) || safeWords <= 0) return false;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalWordsQuota: true, usedWords: true },
    });
    if (!user) return false;

    const total = user.totalWordsQuota ?? 0;
    const used = user.usedWords ?? 0;
    return total - used >= safeWords;
  }

  async deductQuota(userId: string, words: number): Promise<void> {
    const safeWords = Math.floor(words);
    if (!Number.isFinite(safeWords) || safeWords <= 0) {
      throw new BadRequestException('扣减字数不合法');
    }

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { totalWordsQuota: true, usedWords: true },
      });
      if (!user) throw new NotFoundException('用户不存在');

      const total = user.totalWordsQuota ?? 0;
      const used = user.usedWords ?? 0;
      const remaining = total - used;

      if (remaining < safeWords) throw new ForbiddenException('字数额度不足');

      await tx.user.update({
        where: { id: userId },
        data: { usedWords: { increment: safeWords } },
      });
    });
  }

  async refundQuota(userId: string, words: number): Promise<void> {
    const safeWords = Math.floor(words);
    if (!Number.isFinite(safeWords) || safeWords <= 0) {
      throw new BadRequestException('退还字数不合法');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { usedWords: { decrement: safeWords } },
      select: { id: true },
    });
  }

  toSafeUser(user: User): SafeUser {
    const { password, wechatOpenId, wechatUnionId, ...rest } = user;
    void password;
    void wechatOpenId;
    void wechatUnionId;
    return rest;
  }
}
