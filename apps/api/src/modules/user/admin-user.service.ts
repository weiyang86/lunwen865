import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { SafeUser } from '../auth/interfaces/auth-result.interface';
import { UserService } from './user.service';
import type {
  AdminUpdateUserDto,
  BanUserDto,
  GrantQuotaDto,
  QueryUsersDto,
} from './dto/admin-update-user.dto';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

@Injectable()
export class AdminUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  async findAll(query: QueryUsersDto): Promise<{
    items: SafeUser[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (query.role) where['role'] = query.role;
    if (query.status) where['status'] = query.status;

    const startDate = query.startDate ? new Date(query.startDate) : null;
    const endDate = query.endDate ? new Date(query.endDate) : null;
    if (startDate || endDate) {
      where['createdAt'] = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    if (query.keyword) {
      const keyword = query.keyword.trim();
      if (keyword) {
        where['OR'] = [
          { phone: { contains: keyword, mode: 'insensitive' } },
          { email: { contains: keyword, mode: 'insensitive' } },
          { nickname: { contains: keyword, mode: 'insensitive' } },
        ];
      }
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => this.userService.toSafeUser(u)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string): Promise<
    SafeUser & {
      _count: {
        tasks: number;
        refreshTokens: number;
        loginLogs: number;
        orders: number;
      };
      quotas: Array<{ quotaType: string; balance: number }>;
    }
  > {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tasks: true,
            refreshTokens: true,
            loginLogs: true,
            orders: true,
          },
        },
        quotas: { select: { quotaType: true, balance: true } },
      },
    });
    if (!user) throw new NotFoundException('用户不存在');
    const { _count, quotas, ...rest } = user;
    return {
      ...this.userService.toSafeUser(rest),
      _count,
      quotas: quotas.map((q) => ({
        quotaType: String(q.quotaType),
        balance: q.balance,
      })),
    };
  }

  async update(id: string, dto: AdminUpdateUserDto): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role, status: dto.status },
    });
    return this.userService.toSafeUser(user);
  }

  async ban(id: string, dto: BanUserDto): Promise<SafeUser> {
    const bannedUntil =
      typeof dto.days === 'number'
        ? new Date(Date.now() + dto.days * 24 * 60 * 60 * 1000)
        : null;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.BANNED,
        banReason: dto.reason,
        bannedUntil,
      },
    });

    await this.authService.logoutAll(id);
    return this.userService.toSafeUser(user);
  }

  async unban(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE, banReason: null, bannedUntil: null },
    });
    return this.userService.toSafeUser(user);
  }

  async grantQuota(id: string, dto: GrantQuotaDto): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { totalWordsQuota: { increment: dto.words } },
    });
    console.log('[Quota] grant', {
      userId: id,
      words: dto.words,
      reason: dto.reason,
    });
    return this.userService.toSafeUser(user);
  }

  async resetPassword(id: string): Promise<{ tempPassword: string }> {
    const tempPassword = crypto
      .randomBytes(12)
      .toString('base64url')
      .slice(0, 12);
    const hashed = await bcrypt.hash(tempPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
      select: { id: true },
    });

    await this.authService.logoutAll(id);
    return { tempPassword };
  }

  async getStats(): Promise<{
    totalUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    activeUsersToday: number;
    bannedUsers: number;
    byEducationLevel: Record<string, number>;
    byChannel: Record<string, number>;
  }> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);

    const [
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      activeUsersToday,
      bannedUsers,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
      this.prisma.user.count({ where: { lastLoginAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { status: UserStatus.BANNED } }),
    ]);

    const eduGroups = await this.prisma.user.groupBy({
      by: ['educationLevel'],
      _count: { _all: true },
      orderBy: { educationLevel: 'asc' },
    });

    const channelGroups = await this.prisma.user.groupBy({
      by: ['registerChannel'],
      _count: { _all: true },
      orderBy: { registerChannel: 'asc' },
    });

    const byEducationLevel: Record<string, number> = {};
    for (const g of eduGroups) {
      const key = String(g.educationLevel ?? 'UNKNOWN');
      const count = Number(g._count?._all ?? 0);
      byEducationLevel[key] = Number.isFinite(count) ? count : 0;
    }

    const byChannel: Record<string, number> = {};
    for (const g of channelGroups) {
      const key = String(g.registerChannel ?? 'UNKNOWN');
      const count = Number(g._count?._all ?? 0);
      byChannel[key] = Number.isFinite(count) ? count : 0;
    }

    return {
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      activeUsersToday,
      bannedUsers,
      byEducationLevel,
      byChannel,
    };
  }
}
