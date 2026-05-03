import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  phone?: string;
  iat?: number;
  exp?: number;
}
