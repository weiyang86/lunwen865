import { NotFoundException } from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { ExportScope } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { buildSnapshot } from './snapshot.util';

describe('buildSnapshot', () => {
  type PrismaMock = {
    polishTask: {
      findUnique: (args: unknown) => Promise<unknown>;
    };
    task: {
      findUnique: (args: unknown) => Promise<unknown>;
    };
  };

  let prisma: DeepMockProxy<PrismaMock>;

  beforeEach(() => {
    prisma = mockDeep<PrismaMock>();
  });

  it('paperId + polishTaskId 双源时，正文优先用 polish 结果', async () => {
    prisma.polishTask.findUnique.mockResolvedValueOnce({
      originalText: 'ORIGINAL',
      polishedText: 'POLISHED',
      task: { title: 't', user: { nickname: 'n' }, school: { name: 's' } },
      segments: [],
    });

    const snapshot = await buildSnapshot(prisma as unknown as PrismaService, {
      paperId: 'paper1',
      polishTaskId: 'polish1',
      scope: ExportScope.FULL_PAPER,
    });

    expect(prisma.task.findUnique.mock.calls).toHaveLength(0);
    expect(snapshot.sections.length).toBeGreaterThan(0);
    expect(snapshot.sections[0].paragraphs.join('\n')).toContain('POLISHED');
  });

  it('不存在的 paperId → NotFoundException', async () => {
    prisma.task.findUnique.mockResolvedValueOnce(null);

    await expect(
      buildSnapshot(prisma as unknown as PrismaService, {
        paperId: 'missing',
        scope: ExportScope.FULL_PAPER,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
