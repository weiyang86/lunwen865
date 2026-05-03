import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import type { SmsService } from './sms/sms.service';
import type { QuotaService } from '../quota/quota.service';

describe('AuthService', () => {
  type PrismaMock = {
    verifyCode: {
      findFirst: (args: unknown) => Promise<unknown>;
      create: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
    };
    refreshToken: {
      create: (args: unknown) => Promise<unknown>;
      findUnique: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
      updateMany: (args: unknown) => Promise<unknown>;
    };
    loginLog: {
      count: (args: unknown) => Promise<number>;
      create: (args: unknown) => Promise<unknown>;
    };
    user: {
      findFirst: (args: unknown) => Promise<unknown>;
      findUnique: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
    };
  };

  let prisma: DeepMockProxy<PrismaMock>;
  let userService: DeepMockProxy<UserService>;
  let smsService: DeepMockProxy<SmsService>;
  let quotaService: DeepMockProxy<QuotaService>;
  let jwtService: JwtService;
  let configService: ConfigService;
  let authService: AuthService;

  beforeEach(() => {
    prisma = mockDeep<PrismaMock>();
    userService = mockDeep<UserService>();
    smsService = mockDeep<SmsService>();
    quotaService = mockDeep<QuotaService>();

    jwtService = new JwtService({});

    const get = jest.fn(<T = string>(key: string, defaultValue?: T) => {
      const map: Record<string, unknown> = {
        JWT_ACCESS_SECRET: 'access_secret',
        JWT_ACCESS_EXPIRES_IN: '2h',
        JWT_REFRESH_SECRET: 'refresh_secret',
        JWT_REFRESH_EXPIRES_IN: '7d',
        SMS_PROVIDER: 'mock',
      };
      if (key in map) return map[key] as T;
      return defaultValue as T;
    });

    configService = { get } as unknown as ConfigService;

    authService = new AuthService(
      prisma as unknown as PrismaService,
      jwtService,
      configService,
      smsService,
      userService,
      quotaService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sendCode: success + creates record + calls sms (phone)', async () => {
    prisma.verifyCode.findFirst.mockResolvedValueOnce(null);
    prisma.verifyCode.create.mockResolvedValueOnce({ id: 'vc1' });
    smsService.sendCode.mockResolvedValueOnce(undefined);

    await expect(
      authService.sendCode({
        target: '13800138001',
        type: 'phone',
        scene: 'REGISTER',
      }),
    ).resolves.toBeUndefined();

    expect(prisma.verifyCode.create.mock.calls).toHaveLength(1);
    expect(smsService.sendCode.mock.calls).toHaveLength(1);
  });

  it('sendCode: rate limit within 60s', async () => {
    prisma.verifyCode.findFirst.mockResolvedValueOnce({
      createdAt: new Date(Date.now() - 10_000),
    });

    await expect(
      authService.sendCode({
        target: '13800138001',
        type: 'phone',
        scene: 'REGISTER',
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('verifyCode: success (mark used)', async () => {
    prisma.verifyCode.findFirst.mockResolvedValueOnce({
      id: 'vc1',
      code: '123456',
      attemptCount: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.verifyCode.update.mockResolvedValueOnce({ id: 'vc1' });

    await expect(
      authService.verifyCode('13800138001', '123456', 'REGISTER'),
    ).resolves.toBeUndefined();

    const arg = prisma.verifyCode.update.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      where: { id: 'vc1' },
      data: { used: true },
    });
  });

  it('verifyCode: wrong code increments attemptCount', async () => {
    prisma.verifyCode.findFirst.mockResolvedValueOnce({
      id: 'vc1',
      code: '123456',
      attemptCount: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.verifyCode.update.mockResolvedValueOnce({ id: 'vc1' });

    await expect(
      authService.verifyCode('13800138001', '000000', 'REGISTER'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const arg = prisma.verifyCode.update.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      where: { id: 'vc1' },
      data: { attemptCount: { increment: 1 } },
    });
  });

  it('verifyCode: expired', async () => {
    prisma.verifyCode.findFirst.mockResolvedValueOnce({
      id: 'vc1',
      code: '123456',
      attemptCount: 0,
      expiresAt: new Date(Date.now() - 1),
    });

    await expect(
      authService.verifyCode('13800138001', '123456', 'REGISTER'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifyCode: attemptCount >= 5 forbidden', async () => {
    prisma.verifyCode.findFirst.mockResolvedValueOnce({
      id: 'vc1',
      code: '123456',
      attemptCount: 5,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      authService.verifyCode('13800138001', '123456', 'REGISTER'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('register: phone path success -> returns tokens and stores refreshToken', async () => {
    prisma.verifyCode.findFirst.mockResolvedValueOnce({
      id: 'vc1',
      code: '123456',
      attemptCount: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.verifyCode.update.mockResolvedValueOnce({ id: 'vc1' });

    userService.findByPhone.mockResolvedValueOnce(null);
    userService.create.mockResolvedValueOnce({
      id: 'u1',
      phone: '13800138001',
      email: null,
      nickname: '测试用户',
      password: null,
      wechatOpenId: null,
      wechatUnionId: null,
      avatar: null,
      realName: null,
      school: null,
      major: null,
      educationLevel: null,
      grade: null,
      role: 'USER',
      status: 'ACTIVE',
      banReason: null,
      bannedUntil: null,
      totalWordsQuota: 0,
      usedWords: 0,
      registerChannel: null,
      inviterId: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    userService.toSafeUser.mockReturnValueOnce({
      id: 'u1',
      phone: '13800138001',
      email: null,
      nickname: '测试用户',
      avatar: null,
      realName: null,
      school: null,
      major: null,
      educationLevel: null,
      grade: null,
      role: 'USER',
      status: 'ACTIVE',
      banReason: null,
      bannedUntil: null,
      totalWordsQuota: 0,
      usedWords: 0,
      registerChannel: null,
      inviterId: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    prisma.refreshToken.create.mockResolvedValueOnce({ id: 'rt1' });

    const result = await authService.register(
      { phone: '13800138001', code: '123456', nickname: '测试用户' },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    expect(result.user.id).toBe('u1');
    const decodedUnknown = (await jwtService.verifyAsync(result.accessToken, {
      secret: 'access_secret',
    })) as unknown;
    const decoded = decodedUnknown as Record<string, unknown>;
    expect(decoded['sub']).toBe('u1');
    expect(decoded['role']).toBe('USER');
  });

  it('login lock: >=5 failures in 30min rejects', async () => {
    prisma.loginLog.count.mockResolvedValueOnce(5);

    await expect(
      authService.loginByEmail(
        { email: 'a@example.com', password: 'User@123456' },
        { ip: '127.0.0.1', userAgent: 'jest' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refresh: rotates refreshToken and old one cannot be reused', async () => {
    userService.findByEmail.mockResolvedValueOnce(null);
    userService.create.mockResolvedValueOnce({
      id: 'u1',
      phone: null,
      email: 'u1@example.com',
      nickname: '测试用户',
      password: 'hashed',
      wechatOpenId: null,
      wechatUnionId: null,
      avatar: null,
      realName: null,
      school: null,
      major: null,
      educationLevel: null,
      grade: null,
      role: 'USER',
      status: 'ACTIVE',
      banReason: null,
      bannedUntil: null,
      totalWordsQuota: 0,
      usedWords: 0,
      registerChannel: null,
      inviterId: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    userService.toSafeUser.mockReturnValue({
      id: 'u1',
      phone: null,
      email: 'u1@example.com',
      nickname: '测试用户',
      avatar: null,
      realName: null,
      school: null,
      major: null,
      educationLevel: null,
      grade: null,
      role: 'USER',
      status: 'ACTIVE',
      banReason: null,
      bannedUntil: null,
      totalWordsQuota: 0,
      usedWords: 0,
      registerChannel: null,
      inviterId: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    prisma.refreshToken.create.mockResolvedValue({ id: 'rt_create' });

    const first = await authService.register(
      {
        email: 'u1@example.com',
        password: 'User@123456',
        nickname: '测试用户',
      },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    prisma.refreshToken.findUnique
      .mockResolvedValueOnce({
        id: 'rt1',
        userId: 'u1',
        revoked: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .mockResolvedValueOnce({
        id: 'rt1',
        userId: 'u1',
        revoked: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

    prisma.user.findUnique.mockResolvedValueOnce({
      ...first.user,
      password: null,
      wechatOpenId: null,
      wechatUnionId: null,
    });
    prisma.refreshToken.update.mockResolvedValueOnce({ id: 'rt1' });
    prisma.refreshToken.create.mockResolvedValueOnce({ id: 'rt2' });

    const rotated = await authService.refresh(
      { refreshToken: first.refreshToken },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );
    expect(rotated.refreshToken).not.toBe(first.refreshToken);

    await expect(
      authService.refresh(
        { refreshToken: first.refreshToken },
        { ip: '127.0.0.1', userAgent: 'jest' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logout: after logout refresh should fail', async () => {
    userService.findByEmail.mockResolvedValueOnce(null);
    userService.create.mockResolvedValueOnce({
      id: 'u1',
      phone: null,
      email: 'u1@example.com',
      nickname: '测试用户',
      password: 'hashed',
      wechatOpenId: null,
      wechatUnionId: null,
      avatar: null,
      realName: null,
      school: null,
      major: null,
      educationLevel: null,
      grade: null,
      role: 'USER',
      status: 'ACTIVE',
      banReason: null,
      bannedUntil: null,
      totalWordsQuota: 0,
      usedWords: 0,
      registerChannel: null,
      inviterId: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    userService.toSafeUser.mockReturnValueOnce({
      id: 'u1',
      phone: null,
      email: 'u1@example.com',
      nickname: '测试用户',
      avatar: null,
      realName: null,
      school: null,
      major: null,
      educationLevel: null,
      grade: null,
      role: 'USER',
      status: 'ACTIVE',
      banReason: null,
      bannedUntil: null,
      totalWordsQuota: 0,
      usedWords: 0,
      registerChannel: null,
      inviterId: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    prisma.refreshToken.create.mockResolvedValueOnce({
      id: 'rt_create',
    });

    const first = await authService.register(
      {
        email: 'u1@example.com',
        password: 'User@123456',
        nickname: '测试用户',
      },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      id: 'rt1',
      revoked: false,
    });
    prisma.refreshToken.update.mockResolvedValueOnce({ id: 'rt1' });
    await expect(
      authService.logout(first.refreshToken),
    ).resolves.toBeUndefined();

    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      id: 'rt1',
      userId: 'u1',
      revoked: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await expect(
      authService.refresh(
        { refreshToken: first.refreshToken },
        { ip: '127.0.0.1', userAgent: 'jest' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('register: email path hashes password (bcrypt)', async () => {
    userService.findByEmail.mockResolvedValueOnce(null);
    userService.create.mockResolvedValueOnce({
      id: 'u1',
      phone: null,
      email: 'u1@example.com',
      nickname: '测试用户',
      password: 'hashed',
      wechatOpenId: null,
      wechatUnionId: null,
      avatar: null,
      realName: null,
      school: null,
      major: null,
      educationLevel: null,
      grade: null,
      role: 'USER',
      status: 'ACTIVE',
      banReason: null,
      bannedUntil: null,
      totalWordsQuota: 0,
      usedWords: 0,
      registerChannel: null,
      inviterId: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    userService.toSafeUser.mockReturnValueOnce({
      id: 'u1',
      phone: null,
      email: 'u1@example.com',
      nickname: '测试用户',
      avatar: null,
      realName: null,
      school: null,
      major: null,
      educationLevel: null,
      grade: null,
      role: 'USER',
      status: 'ACTIVE',
      banReason: null,
      bannedUntil: null,
      totalWordsQuota: 0,
      usedWords: 0,
      registerChannel: null,
      inviterId: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    prisma.refreshToken.create.mockResolvedValueOnce({
      id: 'rt_create',
    });

    await authService.register(
      {
        email: 'u1@example.com',
        password: 'User@123456',
        nickname: '测试用户',
      },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    const createArgUnknown = userService.create.mock.calls[0]?.[0] as unknown;
    const createArg = createArgUnknown as Record<string, unknown>;
    const hashed = createArg['password'];

    expect(typeof hashed).toBe('string');
    expect(hashed).not.toBe('User@123456');
    expect(await bcrypt.compare('User@123456', String(hashed))).toBe(true);
  });
});
