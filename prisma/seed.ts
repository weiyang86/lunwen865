import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const prisma = new PrismaClient();

  const phone = '13800000000';
  const email = 'admin@example.com';
  const password = await bcrypt.hash('Admin@123456', 10);

  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      email,
      password,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      nickname: '超级管理员',
      totalWordsQuota: 99999999,
      registerChannel: 'seed',
    },
    create: {
      phone,
      email,
      password,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      nickname: '超级管理员',
      totalWordsQuota: 99999999,
      registerChannel: 'seed',
    },
    select: { id: true, phone: true, email: true, role: true },
  });

  console.log('[seed] created/updated super admin:', user);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error('[seed] failed', error);
  process.exit(1);
});
