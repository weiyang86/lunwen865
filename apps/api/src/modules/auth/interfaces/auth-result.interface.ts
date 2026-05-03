import type { User } from '@prisma/client';

export type SafeUser = Omit<
  User,
  'password' | 'wechatOpenId' | 'wechatUnionId'
>;

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ReqContext {
  ip?: string;
  userAgent?: string;
}
