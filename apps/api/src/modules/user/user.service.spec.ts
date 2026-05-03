import { BadRequestException, ConflictException } from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthService } from '../auth/auth.service';
import { UserService } from './user.service';

describe('UserService', () => {
  type PrismaMock = {
    user: {
      findUnique: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
    };
  };

  let prisma: DeepMockProxy<PrismaMock>;
  let authService: DeepMockProxy<AuthService>;
  let userService: UserService;

  beforeEach(() => {
    prisma = mockDeep<PrismaMock>();
    authService = mockDeep<AuthService>();

    userService = new UserService(
      prisma as unknown as PrismaService,
      authService,
    );
  });

  it('findByPhone / findByEmail', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' });
    await expect(userService.findByPhone('13800138001')).resolves.toEqual(
      expect.objectContaining({ id: 'u1' }),
    );

    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u2' });
    await expect(userService.findByEmail('a@example.com')).resolves.toEqual(
      expect.objectContaining({ id: 'u2' }),
    );
  });

  it('update: success', async () => {
    prisma.user.update.mockResolvedValueOnce({
      id: 'u1',
      password: 'secret',
      wechatOpenId: null,
      wechatUnionId: null,
      phone: null,
      email: null,
      nickname: 'n',
    });

    const updated = await userService.update('u1', { nickname: 'n' });
    expect(updated).toEqual(
      expect.objectContaining({ id: 'u1', nickname: 'n' }),
    );
    expect(Object.prototype.hasOwnProperty.call(updated, 'password')).toBe(
      false,
    );
  });

  it('toSafeUser: does not include password', () => {
    const safe = userService.toSafeUser({
      id: 'u1',
      password: 'secret',
      wechatOpenId: 'x',
      wechatUnionId: 'y',
      phone: null,
      email: null,
      nickname: 'n',
    } as never);
    expect(Object.prototype.hasOwnProperty.call(safe, 'password')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(safe, 'wechatOpenId')).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(safe, 'wechatUnionId')).toBe(
      false,
    );
  });

  it('bindPhone: verifyCode error throws', async () => {
    authService.verifyCode.mockRejectedValueOnce(
      new BadRequestException('验证码错误'),
    );

    await expect(
      userService.bindPhone('u1', '13800138001', '000000'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bindPhone: phone already taken throws Conflict', async () => {
    authService.verifyCode.mockResolvedValueOnce(undefined);
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u2' });

    await expect(
      userService.bindPhone('u1', '13800138001', '123456'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
