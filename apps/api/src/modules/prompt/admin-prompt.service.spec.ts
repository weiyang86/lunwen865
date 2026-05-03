import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { AdminPromptService } from './admin-prompt.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptService } from './prompt.service';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

type PrismaTx = {
  promptTemplate: {
    findUnique: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<unknown[]>;
  };
  promptVersion: {
    create: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
  };
};

type PrismaMock = PrismaTx & {
  $transaction: <T>(fn: (tx: PrismaTx) => Promise<T>) => Promise<T>;
};

describe('AdminPromptService', () => {
  let prisma: DeepMockProxy<PrismaMock>;
  let promptService: { invalidate: jest.Mock };
  let service: AdminPromptService;

  beforeEach(() => {
    prisma = mockDeep<PrismaMock>();
    promptService = { invalidate: jest.fn() };

    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    service = new AdminPromptService(
      prisma as unknown as PrismaService,
      promptService as unknown as PromptService,
    );
  });

  it('create：创建模板默认 DRAFT 并写入 v1', async () => {
    prisma.promptTemplate.findUnique.mockResolvedValue(null);
    prisma.promptTemplate.create.mockResolvedValue({
      id: 't1',
      code: 'paper.outline',
      content: 'x',
      variables: [],
      model: null,
      temperature: null,
      maxTokens: null,
    });
    prisma.promptVersion.create.mockResolvedValue({ id: 'v1' });

    const tpl = await service.create('u1', {
      code: 'paper.outline',
      name: 'n',
      scene: 'PAPER_OUTLINE',
      content: 'x',
      variables: [],
    });

    expect(tpl.id).toBe('t1');
    const pvArg = prisma.promptVersion.create.mock.calls[0]?.[0];
    expect(isRecord(pvArg)).toBe(true);
    if (isRecord(pvArg)) {
      const data = pvArg['data'];
      expect(isRecord(data)).toBe(true);
      if (isRecord(data)) {
        expect(data['templateId']).toBe('t1');
        expect(data['version']).toBe(1);
      }
    }
  });

  it('create：code 已存在时拒绝', async () => {
    prisma.promptTemplate.findUnique.mockResolvedValue({ id: 'exists' });
    const dto = {
      code: 'paper.outline',
      name: 'n',
      scene: 'PAPER_OUTLINE',
      content: 'x',
      variables: [],
    } as Parameters<AdminPromptService['create']>[1];
    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('update：每次更新会落新版本并递增 currentVersion', async () => {
    prisma.promptTemplate.findUnique.mockResolvedValue({
      id: 't1',
      currentVersion: 3,
      content: 'old',
      variables: [{ name: 'a' }],
      model: null,
      temperature: null,
      maxTokens: null,
    });
    prisma.promptVersion.create.mockResolvedValue({ id: 'v4' });
    prisma.promptTemplate.update.mockResolvedValue({
      id: 't1',
      currentVersion: 4,
      content: 'new',
    });

    const updated = await service.update('u1', 't1', {
      content: 'new',
      changelog: 'c',
    });

    expect(updated.currentVersion).toBe(4);
    const vArg = prisma.promptVersion.create.mock.calls[0]?.[0];
    expect(isRecord(vArg)).toBe(true);
    if (isRecord(vArg)) {
      const data = vArg['data'];
      expect(isRecord(data)).toBe(true);
      if (isRecord(data)) {
        expect(data['templateId']).toBe('t1');
        expect(data['version']).toBe(4);
        expect(data['content']).toBe('new');
        expect(data['changelog']).toBe('c');
      }
    }

    const uArg = prisma.promptTemplate.update.mock.calls[0]?.[0];
    expect(isRecord(uArg)).toBe(true);
    if (isRecord(uArg)) {
      const where = uArg['where'];
      const data = uArg['data'];
      expect(isRecord(where)).toBe(true);
      expect(isRecord(data)).toBe(true);
      if (isRecord(where)) expect(where['id']).toBe('t1');
      if (isRecord(data)) {
        expect(data['currentVersion']).toBe(4);
        expect(data['updatedBy']).toBe('u1');
      }
    }
  });

  it('publish：会置 ACTIVE 并清缓存', async () => {
    const updateSpy = jest.spyOn(service, 'update');
    prisma.promptTemplate.update.mockResolvedValue({ id: 't1' });
    prisma.promptTemplate.findUnique.mockResolvedValue({
      id: 't1',
      versions: [],
    });

    await service.publish('u1', 't1', {});
    expect(updateSpy).not.toHaveBeenCalled();
    expect(promptService.invalidate).toHaveBeenCalledTimes(1);
  });

  it('publish：带 content 等同 update + publish', async () => {
    prisma.promptTemplate.update.mockResolvedValue({ id: 't1' });
    prisma.promptTemplate.findUnique.mockResolvedValue({
      id: 't1',
      versions: [],
    });

    const updateSpy = jest
      .spyOn(service, 'update')
      .mockResolvedValue({ id: 't1' } as unknown as never);

    await service.publish('u1', 't1', { content: 'x' });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(promptService.invalidate).toHaveBeenCalledTimes(1);
  });

  it('archive：会置 ARCHIVED 并清缓存', async () => {
    prisma.promptTemplate.update.mockResolvedValue({ id: 't1' });
    prisma.promptTemplate.findUnique.mockResolvedValue({
      id: 't1',
      versions: [],
    });
    await service.archive('u1', 't1');
    expect(promptService.invalidate).toHaveBeenCalledTimes(1);
  });

  it('restore：回滚指定版本会产生新版本', async () => {
    prisma.promptVersion.findUnique.mockResolvedValue({
      content: 'v3',
      variables: [],
      model: null,
      temperature: null,
      maxTokens: null,
    });
    const updateSpy = jest
      .spyOn(service, 'update')
      .mockResolvedValue({ id: 't1' } as unknown as never);
    prisma.promptTemplate.findUnique.mockResolvedValue({
      id: 't1',
      versions: [],
    });

    await service.restore('u1', 't1', 3);
    const call = updateSpy.mock.calls[0];
    expect(call?.[0]).toBe('u1');
    expect(call?.[1]).toBe('t1');
    const dto = call?.[2] as unknown;
    expect(isRecord(dto)).toBe(true);
    if (isRecord(dto)) {
      expect(dto['content']).toBe('v3');
      expect(dto['changelog']).toBe('回滚自 v3');
    }
  });

  it('diff：返回 diff 结构数组', async () => {
    prisma.promptVersion.findUnique.mockResolvedValueOnce({
      content: 'a\nb\nc',
    });
    prisma.promptVersion.findUnique.mockResolvedValueOnce({
      content: 'a\nx\nc',
    });
    const r = await service.diff('t1', 1, 2);
    expect(r.from.version).toBe(1);
    expect(typeof r.from.content).toBe('string');
    expect(r.to.version).toBe(2);
    expect(typeof r.to.content).toBe('string');
    expect(Array.isArray(r.diff)).toBe(true);
  });

  it('testRender：缺变量返回 success=false', async () => {
    prisma.promptTemplate.findUnique.mockResolvedValue({
      id: 't1',
      content: 'hello {{x}}',
      variables: [{ name: 'x', required: true }],
    });
    const r = await service.testRender('t1', {});
    expect(r.success).toBe(false);
    expect(isRecord(r)).toBe(true);
    if (isRecord(r)) expect(typeof r['error']).toBe('string');
  });

  it('remove：仅 DRAFT 可删', async () => {
    prisma.promptTemplate.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: 'ACTIVE',
    });
    await expect(service.remove('t1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.promptTemplate.findUnique.mockResolvedValueOnce({
      id: 't2',
      status: 'DRAFT',
    });
    prisma.promptTemplate.delete.mockResolvedValue({ id: 't2' });
    await expect(service.remove('t2')).resolves.toMatchObject({
      success: true,
    });
  });

  it('versions：模板不存在抛 404', async () => {
    prisma.promptTemplate.findUnique.mockResolvedValue(null);
    await expect(service.versions('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
