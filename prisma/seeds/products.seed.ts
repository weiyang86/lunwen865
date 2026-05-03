import { PrismaClient, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  {
    code: 'TRIAL',
    name: '体验包',
    priceCents: 100,
    paperQuota: 1,
    polishQuota: 3,
    exportQuota: 2,
    aiChatQuota: 0,
    status: ProductStatus.ACTIVE,
    sortOrder: 10,
  },
  {
    code: 'BASIC',
    name: '基础版',
    priceCents: 1990,
    originalPriceCents: 2990,
    paperQuota: 5,
    polishQuota: 20,
    exportQuota: 10,
    aiChatQuota: 0,
    status: ProductStatus.ACTIVE,
    sortOrder: 20,
  },
  {
    code: 'PRO',
    name: '专业版',
    priceCents: 4990,
    originalPriceCents: 6990,
    paperQuota: 20,
    polishQuota: 80,
    exportQuota: 40,
    aiChatQuota: 0,
    status: ProductStatus.ACTIVE,
    sortOrder: 30,
  },
] as const;

async function main() {
  let created = 0;
  let skipped = 0;

  for (const p of products) {
    const existed = await prisma.product.findUnique({
      where: { code: p.code },
      select: { id: true },
    });
    if (existed) {
      skipped += 1;
      continue;
    }
    await prisma.product.create({ data: p });
    created += 1;
  }

  console.log(
    `[seed:products] created=${created} skipped=${skipped} total=${products.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

