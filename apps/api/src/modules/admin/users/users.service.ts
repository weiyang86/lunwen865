import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

type ApiUserStatus = 'ACTIVE' | 'DISABLED';

function toApiStatus(status: UserStatus): ApiUserStatus {
  return status === UserStatus.ACTIVE ? 'ACTIVE' : 'DISABLED';
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListUsersDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const where: Prisma.UserWhereInput = {};

    if (dto.status && dto.status !== 'ALL') {
      if (dto.status === 'ACTIVE') where.status = UserStatus.ACTIVE;
      if (dto.status === 'DISABLED')
        where.status = { in: [UserStatus.BANNED, UserStatus.DELETED] };
    }

    if (dto.keyword?.trim()) {
      const k = dto.keyword.trim();
      where.OR = [
        { phone: { contains: k } },
        { nickname: { contains: k } },
        { email: { contains: k } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          phone: true,
          nickname: true,
          email: true,
          avatar: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        id: u.id,
        phone: u.phone ?? '',
        nickname: u.nickname ?? '',
        email: u.email ?? null,
        avatar: u.avatar ?? null,
        status: toApiStatus(u.status),
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        nickname: true,
        email: true,
        avatar: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { orders: true } },
      },
    });
    if (!user) throw new NotFoundException('用户不存在');

    return {
      id: user.id,
      phone: user.phone ?? '',
      nickname: user.nickname ?? '',
      email: user.email ?? null,
      avatar: user.avatar ?? null,
      status: toApiStatus(user.status),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      _count: { orders: user._count.orders },
    };
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto) {
    await this.detail(id);
    const nextStatus =
      dto.status === 'ACTIVE' ? UserStatus.ACTIVE : UserStatus.BANNED;

    const updated = await this.prisma.user.update({
      where: { id },
      data:
        nextStatus === UserStatus.ACTIVE
          ? { status: nextStatus, banReason: null, bannedUntil: null }
          : { status: nextStatus },
      select: { id: true, status: true },
    });

    return { id: updated.id, status: toApiStatus(updated.status) };
  }
}
