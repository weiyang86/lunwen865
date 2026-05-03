import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { PromptScene, PromptStatus, type PromptTemplate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptService } from './prompt.service';

type PrismaMock = {
  promptTemplate: {
    findMany: (args: unknown) => Promise<PromptTemplate[]>;
    findUnique: (args: {
      where: { code: string };
    }) => Promise<PromptTemplate | null>;
  };
};

describe('PromptService', () => {
  let prisma: DeepMockProxy<PrismaMock>;
  let service: PromptService;

  function makeTemplate(
    partial: Partial<PromptTemplate> & Pick<PromptTemplate, 'id' | 'code'>,
  ): PromptTemplate {
    return {
      id: partial.id,
      code: partial.code,
      name: partial.name ?? 'n',
      scene: partial.scene ?? PromptScene.OTHER,
      description: partial.description ?? null,
      content: partial.content ?? '',
      variables: partial.variables ?? [],
      model: partial.model ?? null,
      temperature: partial.temperature ?? null,
      maxTokens: partial.maxTokens ?? null,
      status: partial.status ?? PromptStatus.ACTIVE,
      currentVersion: partial.currentVersion ?? 1,
      createdBy: partial.createdBy ?? 'u',
      updatedBy: partial.updatedBy ?? 'u',
      createdAt: partial.createdAt ?? new Date(),
      updatedAt: partial.updatedAt ?? new Date(),
    };
  }

  beforeEach(() => {
    prisma = mockDeep<PrismaMock>();
    service = new PromptService(prisma as unknown as PrismaService);
  });

  it('onModuleInit：预热只缓存 ACTIVE', async () => {
    prisma.promptTemplate.findMany.mockResolvedValue([
      makeTemplate({ id: 't1', code: 'c1', status: PromptStatus.ACTIVE }),
      makeTemplate({ id: 't2', code: 'c2', status: PromptStatus.ACTIVE }),
    ]);

    await service.onModuleInit();
    await expect(service.get('c1')).resolves.toMatchObject({ id: 't1' });
    await expect(service.get('c2')).resolves.toMatchObject({ id: 't2' });
    expect(prisma.promptTemplate.findMany).toHaveBeenCalledTimes(1);
  });

  it('get：缓存命中不再查库', async () => {
    prisma.promptTemplate.findMany.mockResolvedValue([
      makeTemplate({
        id: 't1',
        code: 'paper.outline',
        status: PromptStatus.ACTIVE,
      }),
    ]);
    await service.onModuleInit();

    prisma.promptTemplate.findUnique.mockResolvedValue(null);
    await expect(service.get('paper.outline')).resolves.toMatchObject({
      id: 't1',
    });
    expect(prisma.promptTemplate.findUnique).not.toHaveBeenCalled();
  });

  it('get：缓存过期触发 reload', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(0);
    prisma.promptTemplate.findMany.mockResolvedValueOnce([
      makeTemplate({ id: 't1', code: 'c1', status: PromptStatus.ACTIVE }),
    ]);
    await service.onModuleInit();

    nowSpy.mockReturnValueOnce(61_000);
    prisma.promptTemplate.findMany.mockResolvedValueOnce([
      makeTemplate({ id: 't2', code: 'c2', status: PromptStatus.ACTIVE }),
    ]);

    await expect(service.get('c2')).resolves.toMatchObject({ id: 't2' });
    expect(prisma.promptTemplate.findMany).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('get：缓存未命中时会兜底查库并写回缓存', async () => {
    prisma.promptTemplate.findMany.mockResolvedValue([]);
    await service.onModuleInit();

    prisma.promptTemplate.findUnique.mockResolvedValue({
      ...makeTemplate({ id: 't3', code: 'c3', status: PromptStatus.ACTIVE }),
      content: 'hi',
      variables: [],
    });

    await expect(service.get('c3')).resolves.toMatchObject({ id: 't3' });
    prisma.promptTemplate.findUnique.mockResolvedValue(null);
    await expect(service.get('c3')).resolves.toMatchObject({ id: 't3' });
    expect(prisma.promptTemplate.findUnique).toHaveBeenCalledTimes(1);
  });

  it('get：模板不存在抛 404', async () => {
    prisma.promptTemplate.findMany.mockResolvedValue([]);
    await service.onModuleInit();
    prisma.promptTemplate.findUnique.mockResolvedValue(null);
    await expect(service.get('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('get：模板未启用抛错', async () => {
    prisma.promptTemplate.findMany.mockResolvedValue([]);
    await service.onModuleInit();
    prisma.promptTemplate.findUnique.mockResolvedValue({
      ...makeTemplate({ id: 't4', code: 'c4', status: PromptStatus.DRAFT }),
    });
    await expect(service.get('c4')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('render：变量替换与默认值生效', async () => {
    prisma.promptTemplate.findMany.mockResolvedValue([]);
    await service.onModuleInit();
    prisma.promptTemplate.findUnique.mockResolvedValue({
      ...makeTemplate({ id: 't5', code: 'c5', status: PromptStatus.ACTIVE }),
      content: 'A={{a}} B={{b}} C={{c}}',
      variables: [
        { name: 'a', required: true },
        { name: 'b', required: true, defaultValue: 'B0' },
      ],
      model: 'm1',
      temperature: 0.7,
      maxTokens: 123,
    });

    const r = await service.render('c5', { a: 1, c: 'x' });
    expect(r.content).toBe('A=1 B=B0 C=x');
    expect(r.model).toBe('m1');
    expect(r.temperature).toBe(0.7);
    expect(r.maxTokens).toBe(123);
  });

  it('render：required 且无默认值缺失时抛错', async () => {
    prisma.promptTemplate.findMany.mockResolvedValue([]);
    await service.onModuleInit();
    prisma.promptTemplate.findUnique.mockResolvedValue({
      ...makeTemplate({ id: 't6', code: 'c6', status: PromptStatus.ACTIVE }),
      content: 'A={{a}}',
      variables: [{ name: 'a', required: true }],
    });

    await expect(service.render('c6', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
