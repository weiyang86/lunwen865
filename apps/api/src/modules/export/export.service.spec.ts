import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExportStatus } from '@prisma/client';
import * as fs from 'node:fs';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ExportQueue } from './export.queue';
import type { QuotaService } from '../quota/quota.service';
import { ExportService } from './export.service';
import { deleteFileIfExists } from './utils/cleanup.util';

jest.mock('./utils/cleanup.util', () => ({
  deleteFileIfExists: jest.fn(() => Promise.resolve(true)),
}));

describe('ExportService', () => {
  type PrismaMock = {
    exportTask: {
      create: (args: unknown) => Promise<unknown>;
      findMany: (args: unknown) => Promise<unknown[]>;
      count: (args: unknown) => Promise<number>;
      findUnique: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
      updateMany: (args: unknown) => Promise<unknown>;
      delete: (args: unknown) => Promise<unknown>;
      groupBy: (args: unknown) => Promise<unknown[]>;
    };
    task: {
      findUnique: (args: unknown) => Promise<unknown>;
    };
    polishTask: {
      findUnique: (args: unknown) => Promise<unknown>;
    };
  };

  let prisma: DeepMockProxy<PrismaMock>;
  let queue: DeepMockProxy<ExportQueue>;
  let quotaService: DeepMockProxy<QuotaService>;
  let service: ExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mockDeep<PrismaMock>();
    queue = mockDeep<ExportQueue>();
    quotaService = mockDeep<QuotaService>();
    quotaService.ensure.mockResolvedValue(undefined);
    service = new ExportService(
      prisma as unknown as PrismaService,
      queue,
      quotaService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('create：未提供 paperId/polishTaskId → BadRequestException', async () => {
    await expect(
      service.create('u1', {
        scope: 'FULL_PAPER',
        title: 't',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create：paperId 不属于当前用户 → ForbiddenException', async () => {
    prisma.task.findUnique.mockResolvedValueOnce({ id: 'p1', userId: 'u2' });

    await expect(
      service.create('u1', {
        scope: 'FULL_PAPER',
        title: 't',
        paperId: 'p1',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create 成功：返回 PENDING、expiresAt = now + 7d ± 1min', async () => {
    const now = Date.now();
    prisma.task.findUnique.mockResolvedValueOnce({ id: 'p1', userId: 'u1' });

    prisma.exportTask.create.mockImplementationOnce((args) => {
      const a = args as { data: Record<string, unknown> };
      return Promise.resolve({
        id: 'e1',
        status: ExportStatus.PENDING,
        progress: 0,
        fileName: null,
        fileSize: null,
        downloadCount: 0,
        errorMessage: null,
        createdAt: new Date(),
        expiresAt: a.data.expiresAt ?? null,
      });
    });

    const created = await service.create('u1', {
      scope: 'FULL_PAPER',
      paperId: 'p1',
      title: 't',
    } as never);

    expect(created.status).toBe(ExportStatus.PENDING);
    expect(queue.enqueue.mock.calls).toHaveLength(1);
    expect(created.expiresAt).toBeInstanceOf(Date);

    const expiresAt = (created.expiresAt as Date).getTime();
    const expected = now + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiresAt - expected)).toBeLessThanOrEqual(60 * 1000);
  });

  it('findOne 跨用户 → ForbiddenException', async () => {
    prisma.exportTask.findUnique.mockResolvedValueOnce({
      id: 'e1',
      userId: 'u2',
    });

    await expect(service.findOne('u1', 'e1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('getDownloadInfo：状态非 SUCCESS → BadRequestException', async () => {
    prisma.exportTask.findUnique.mockResolvedValueOnce({
      id: 'e1',
      userId: 'u1',
      status: ExportStatus.PROCESSING,
      expiresAt: new Date(Date.now() + 1000),
      filePath: '/tmp/x.docx',
      fileName: 'x.docx',
    });

    await expect(service.getDownloadInfo('u1', 'e1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('getDownloadInfo：已过期 → BadRequestException', async () => {
    prisma.exportTask.findUnique.mockResolvedValueOnce({
      id: 'e1',
      userId: 'u1',
      status: ExportStatus.SUCCESS,
      expiresAt: new Date(Date.now() - 1000),
      filePath: '/tmp/x.docx',
      fileName: 'x.docx',
    });

    await expect(service.getDownloadInfo('u1', 'e1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('getDownloadInfo：文件丢失 → BadRequestException', async () => {
    prisma.exportTask.findUnique.mockResolvedValueOnce({
      id: 'e1',
      userId: 'u1',
      status: ExportStatus.SUCCESS,
      expiresAt: new Date(Date.now() + 1000),
      filePath: '/tmp/missing.docx',
      fileName: 'x.docx',
    });
    jest.spyOn(fs.promises, 'stat').mockRejectedValueOnce(new Error('ENOENT'));

    await expect(service.getDownloadInfo('u1', 'e1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('getDownloadInfo 成功：downloadCount +1', async () => {
    prisma.exportTask.findUnique.mockResolvedValueOnce({
      id: 'e1',
      userId: 'u1',
      status: ExportStatus.SUCCESS,
      expiresAt: new Date(Date.now() + 1000),
      filePath: '/tmp/x.docx',
      fileName: 'x.docx',
    });
    jest.spyOn(fs.promises, 'stat').mockResolvedValueOnce({} as never);

    prisma.exportTask.update.mockResolvedValueOnce({
      filePath: '/tmp/x.docx',
      fileName: 'x.docx',
    });

    const info = await service.getDownloadInfo('u1', 'e1');
    expect(info).toEqual({ filePath: '/tmp/x.docx', fileName: 'x.docx' });
    expect(prisma.exportTask.update.mock.calls).toHaveLength(1);
  });

  it('retry：非 FAILED → BadRequestException', async () => {
    prisma.exportTask.findUnique.mockResolvedValueOnce({
      id: 'e1',
      userId: 'u1',
      status: ExportStatus.SUCCESS,
    });

    await expect(service.retry('u1', 'e1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('delete：清理文件 + DB 记录消失', async () => {
    prisma.exportTask.findUnique.mockResolvedValueOnce({
      id: 'e1',
      userId: 'u1',
      filePath: '/tmp/x.docx',
    });
    prisma.exportTask.delete.mockResolvedValueOnce({ id: 'e1' });

    await service.delete('u1', 'e1');
    expect(deleteFileIfExists as unknown as jest.Mock).toHaveBeenCalledTimes(1);
    expect(prisma.exportTask.delete.mock.calls).toHaveLength(1);
  });

  it('cleanupExpired：仅清理 SUCCESS 且 expiresAt < now', async () => {
    prisma.exportTask.findMany.mockResolvedValueOnce([
      { id: 'e1', filePath: '/tmp/1.docx' },
      { id: 'e2', filePath: null },
    ]);
    prisma.exportTask.update.mockResolvedValue({});

    const n = await service.cleanupExpired();
    expect(n).toBe(2);
    expect(deleteFileIfExists as unknown as jest.Mock).toHaveBeenCalledTimes(2);
    expect(prisma.exportTask.update.mock.calls).toHaveLength(2);
  });
});
