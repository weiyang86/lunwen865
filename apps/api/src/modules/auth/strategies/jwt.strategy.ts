import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

type JwtUser = {
  id: string;
  role: UserRole;
  phone?: string;
  agencyId?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET', ''),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        phone: true,
        status: true,
        bannedUntil: true,
        registerChannel: true,
      },
    });

    if (!user) throw new UnauthorizedException('用户不存在');

    const now = new Date();
    if (user.status === 'BANNED') {
      if (!user.bannedUntil || user.bannedUntil > now) {
        throw new ForbiddenException('账号已被封禁');
      }
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('账号不可用');
    }

    const agencyId = user.registerChannel?.startsWith('agency:')
      ? user.registerChannel.slice('agency:'.length)
      : undefined;

    return {
      id: user.id,
      role: user.role,
      phone: user.phone ?? undefined,
      agencyId,
    };
  }
}
