import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Prisma,
  PromptScene,
  PromptStatus as PrismaPromptStatus,
  UserRole,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';

class CreateAdminPromptDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_.-]{1,63}$/)
  sceneKey!: string;

  @IsString()
  @MaxLength(50)
  name!: string;

  @IsString()
  @MaxLength(200)
  description!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

type AdminPromptStatus = 'ENABLED' | 'DISABLED';

class ListAdminPromptsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(['ENABLED', 'DISABLED'])
  status?: AdminPromptStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

class SaveDraftDto {
  @IsString()
  content!: string;

  @IsArray()
  variables!: unknown[];

  modelConfig!: unknown;
  metadata!: unknown;
}

class CreateVersionDto {
  @IsString()
  content!: string;

  @IsArray()
  variables!: unknown[];

  modelConfig!: unknown;
  metadata!: unknown;

  @IsString()
  @MaxLength(200)
  commitMessage!: string;
}

class ListVersionsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

class RunPromptTestDto {
  @IsString()
  content!: string;

  @IsArray()
  variables!: unknown[];

  variableValues!: unknown;

  modelConfig!: unknown;

  metadata!: unknown;

  stream!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  timeoutMs?: number;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function mapStatus(s: PrismaPromptStatus): AdminPromptStatus {
  return s === PrismaPromptStatus.ACTIVE ? 'ENABLED' : 'DISABLED';
}

function mapCurrentVersionNo(tpl: {
  status: PrismaPromptStatus;
  currentVersion: number;
}) {
  return tpl.status === PrismaPromptStatus.ACTIVE ? tpl.currentVersion : null;
}

function toIso(d: Date) {
  return d.toISOString();
}

function toModelConfig(
  raw: unknown,
  fallback: {
    model?: string | null;
    temperature?: number | null;
    maxTokens?: number | null;
  },
) {
  const baseTemp =
    typeof fallback.temperature === 'number' ? fallback.temperature : 0.7;
  const baseMaxTokens =
    typeof fallback.maxTokens === 'number' ? fallback.maxTokens : 2048;
  const baseModel = fallback.model ?? 'gpt-4o';

  if (!isRecord(raw)) {
    return {
      provider: 'openai',
      model: baseModel,
      temperature: baseTemp,
      maxTokens: baseMaxTokens,
    };
  }

  const pickStr = (k: string, def: string) => {
    const v = raw[k];
    return typeof v === 'string' && v.trim() ? v : def;
  };
  const pickNum = (k: string, def: number) => {
    const v = raw[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : def;
  };

  const provider = pickStr('provider', 'openai');
  const model = pickStr('model', baseModel);
  const temperature = pickNum('temperature', baseTemp);
  const maxTokens = Math.trunc(pickNum('maxTokens', baseMaxTokens));

  const topP = raw['topP'];
  const frequencyPenalty = raw['frequencyPenalty'];
  const presencePenalty = raw['presencePenalty'];

  return {
    provider,
    model,
    temperature,
    maxTokens,
    ...(typeof topP === 'number' && Number.isFinite(topP) ? { topP } : {}),
    ...(typeof frequencyPenalty === 'number' &&
    Number.isFinite(frequencyPenalty)
      ? { frequencyPenalty }
      : {}),
    ...(typeof presencePenalty === 'number' && Number.isFinite(presencePenalty)
      ? { presencePenalty }
      : {}),
  };
}

function toMetadata(
  raw: unknown,
  fallback: { title: string; description: string; tags: string[] },
) {
  if (!isRecord(raw)) return fallback;
  const title =
    typeof raw['title'] === 'string' && raw['title'].trim()
      ? raw['title']
      : fallback.title;
  const description =
    typeof raw['description'] === 'string'
      ? raw['description']
      : fallback.description;
  const tags = Array.isArray(raw['tags'])
    ? raw['tags'].filter((t) => typeof t === 'string')
    : fallback.tags;
  return { title, description, tags };
}

type UserLite = {
  id: string;
  realName: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
};

function displayName(u: UserLite) {
  return u.realName || u.nickname || u.email || u.phone || u.id.slice(0, 6);
}

function toVariables(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    name: string;
    label: string;
    type: 'text';
    required: boolean;
    defaultValue?: string;
    description?: string;
  }> = [];

  for (const item of raw) {
    if (!isRecord(item)) continue;
    const name = item['name'];
    if (typeof name !== 'string' || name.length === 0) continue;
    const label = item['label'];
    const required = item['required'];
    const defaultValue = item['defaultValue'];
    const description = item['description'];
    out.push({
      name,
      label: typeof label === 'string' && label.length > 0 ? label : name,
      type: 'text',
      required: required === true,
      defaultValue: typeof defaultValue === 'string' ? defaultValue : undefined,
      description: typeof description === 'string' ? description : undefined,
    });
  }

  return out;
}

function writeSse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function renderTemplate(content: string, values: Record<string, unknown>) {
  return content.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
    (_, name: string) => {
      const v = values[name];
      if (v === null || v === undefined) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'number') return String(v);
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      try {
        return JSON.stringify(v);
      } catch {
        return '[unserializable]';
      }
    },
  );
}

@Controller(['admin/prompts', 'prompts'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminPromptsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() q: ListAdminPromptsQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const keyword = q.keyword?.trim() ? q.keyword.trim() : undefined;
    const status = q.status;

    const where: Prisma.PromptTemplateWhereInput = {};
    if (keyword) {
      where.OR = [
        { code: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    if (status === 'ENABLED') where.status = PrismaPromptStatus.ACTIVE;
    if (status === 'DISABLED')
      where.NOT = { status: PrismaPromptStatus.ACTIVE };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.promptTemplate.count({ where }),
      this.prisma.promptTemplate.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((tpl) => ({
        id: tpl.id,
        sceneKey: tpl.code,
        name: tpl.name,
        description: tpl.description ?? '',
        tags: tpl.tags,
        currentVersionNo: mapCurrentVersionNo(tpl),
        status: mapStatus(tpl.status),
        createdAt: toIso(tpl.createdAt),
        updatedAt: toIso(tpl.updatedAt),
        updatedBy: null,
      })),
      total,
      page,
      pageSize,
    };
  }

  @Get('tags')
  async tags() {
    const items = await this.prisma.promptTemplate.findMany({
      select: { tags: true },
    });
    const set = new Set<string>();
    for (const it of items) {
      for (const t of it.tags) set.add(t);
    }
    return Array.from(set).sort();
  }

  @Get('models')
  models() {
    return [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
      { id: 'qwen-turbo', label: 'Qwen Turbo', provider: 'qwen' },
      { id: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek' },
    ];
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const tpl = await this.prisma.promptTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        tags: true,
        status: true,
        currentVersion: true,
        draftContent: true,
        draftVariables: true,
        draftModel: true,
        draftModelParams: true,
        draftModelConfig: true,
        draftMetadata: true,
        draftUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!tpl) throw new NotFoundException('模板不存在');

    const currentVersionNo = mapCurrentVersionNo(tpl);
    const currentVersion =
      currentVersionNo === null
        ? null
        : await this.prisma.promptVersion.findUnique({
            where: {
              templateId_version: {
                templateId: tpl.id,
                version: currentVersionNo,
              },
            },
            select: {
              id: true,
              templateId: true,
              version: true,
              content: true,
              variables: true,
              model: true,
              temperature: true,
              maxTokens: true,
              modelConfig: true,
              metadata: true,
              changelog: true,
              createdAt: true,
            },
          });

    const metaFallback = {
      title: tpl.name,
      description: tpl.description ?? '',
      tags: tpl.tags,
    };

    return {
      id: tpl.id,
      sceneKey: tpl.code,
      name: tpl.name,
      description: tpl.description ?? '',
      tags: tpl.tags,
      currentVersionNo,
      status: mapStatus(tpl.status),
      createdAt: toIso(tpl.createdAt),
      updatedAt: toIso(tpl.updatedAt),
      updatedBy: null,
      currentVersion: currentVersion
        ? {
            id: currentVersion.id,
            templateId: currentVersion.templateId,
            versionNo: currentVersion.version,
            content: currentVersion.content,
            variables: toVariables(currentVersion.variables),
            modelConfig: toModelConfig(currentVersion.modelConfig, {
              model: currentVersion.model,
              temperature: currentVersion.temperature,
              maxTokens: currentVersion.maxTokens,
            }),
            metadata: toMetadata(currentVersion.metadata, metaFallback),
            changelog: currentVersion.changelog ?? '',
            createdAt: toIso(currentVersion.createdAt),
            createdBy: null,
          }
        : null,
      draft:
        tpl.draftUpdatedAt && tpl.draftContent !== null
          ? {
              templateId: tpl.id,
              content: tpl.draftContent,
              variables: toVariables(tpl.draftVariables),
              modelConfig: toModelConfig(
                tpl.draftModelConfig ?? tpl.draftModelParams,
                {
                  model: tpl.draftModel ?? currentVersion?.model,
                  temperature: currentVersion?.temperature,
                  maxTokens: currentVersion?.maxTokens,
                },
              ),
              metadata: toMetadata(tpl.draftMetadata, metaFallback),
              updatedAt: toIso(tpl.draftUpdatedAt),
            }
          : null,
    };
  }

  @Put(':id/draft')
  async saveDraft(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: SaveDraftDto,
  ) {
    const now = new Date();
    const modelConfig = toModelConfig(dto.modelConfig, {});
    const metaFallback = {
      title: '',
      description: '',
      tags: [],
    };
    const metadata = toMetadata(dto.metadata, metaFallback);
    const updated = await this.prisma.promptTemplate.update({
      where: { id },
      data: {
        draftContent: dto.content,
        draftVariables: (dto.variables ?? []) as Prisma.InputJsonValue,
        draftModel: modelConfig.model,
        draftModelParams: modelConfig,
        draftModelConfig: modelConfig,
        draftMetadata: metadata,
        draftUpdatedAt: now,
        updatedBy: uid,
      },
      select: {
        id: true,
        draftContent: true,
        draftVariables: true,
        draftModel: true,
        draftModelParams: true,
        draftModelConfig: true,
        draftMetadata: true,
        draftUpdatedAt: true,
      },
    });

    return {
      templateId: updated.id,
      content: updated.draftContent ?? '',
      variables: toVariables(updated.draftVariables),
      modelConfig: toModelConfig(
        updated.draftModelConfig ?? updated.draftModelParams,
        {
          model: updated.draftModel,
        },
      ),
      metadata: toMetadata(updated.draftMetadata, {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
      }),
      updatedAt: toIso(updated.draftUpdatedAt ?? now),
    };
  }

  @Delete(':id/draft')
  async discardDraft(@CurrentUser('id') uid: string, @Param('id') id: string) {
    await this.prisma.promptTemplate.update({
      where: { id },
      data: {
        draftContent: null,
        draftVariables: Prisma.DbNull,
        draftModel: null,
        draftModelParams: Prisma.DbNull,
        draftModelConfig: Prisma.DbNull,
        draftMetadata: Prisma.DbNull,
        draftUpdatedAt: null,
        updatedBy: uid,
      },
      select: { id: true },
    });
    return { success: true };
  }

  @Post(':id/versions')
  async createVersion(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: CreateVersionDto,
  ) {
    const modelConfig = toModelConfig(dto.modelConfig, {});
    const metadata = toMetadata(dto.metadata, {
      title: '',
      description: '',
      tags: [],
    });

    const version = await this.prisma.$transaction(async (tx) => {
      const tpl = await tx.promptTemplate.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!tpl) throw new NotFoundException('模板不存在');

      const last = await tx.promptVersion.aggregate({
        where: { templateId: id },
        _max: { version: true },
      });
      const nextNo = (last._max.version ?? 0) + 1;

      const created = await tx.promptVersion.create({
        data: {
          templateId: id,
          version: nextNo,
          content: dto.content,
          variables: (dto.variables ?? []) as Prisma.InputJsonValue,
          model: modelConfig.model,
          temperature: modelConfig.temperature,
          maxTokens: modelConfig.maxTokens,
          modelConfig: modelConfig,
          metadata: metadata,
          changelog: dto.commitMessage,
          operatorId: uid,
        },
      });

      await tx.promptTemplate.update({
        where: { id },
        data: {
          name: metadata.title,
          description: metadata.description || null,
          tags: metadata.tags,
          content: dto.content,
          variables: (dto.variables ?? []) as Prisma.InputJsonValue,
          model: modelConfig.model,
          temperature: modelConfig.temperature,
          maxTokens: modelConfig.maxTokens,
          status: PrismaPromptStatus.ACTIVE,
          currentVersion: nextNo,
          draftContent: null,
          draftVariables: Prisma.DbNull,
          draftModel: null,
          draftModelParams: Prisma.DbNull,
          draftModelConfig: Prisma.DbNull,
          draftMetadata: Prisma.DbNull,
          draftUpdatedAt: null,
          updatedBy: uid,
        },
      });

      return created;
    });

    return {
      id: version.id,
      templateId: version.templateId,
      versionNo: version.version,
      content: version.content,
      variables: toVariables(version.variables),
      modelConfig: toModelConfig(version.modelConfig, {
        model: version.model,
        temperature: version.temperature,
        maxTokens: version.maxTokens,
      }),
      metadata: toMetadata(version.metadata, metadata),
      changelog: version.changelog ?? '',
      createdAt: toIso(version.createdAt),
      createdBy: null,
    };
  }

  @Get(':id/versions')
  async listVersions(
    @Param('id') id: string,
    @Query() q: ListVersionsQueryDto,
  ) {
    const limit = q.limit ?? 20;

    const tpl = await this.prisma.promptTemplate.findUnique({
      where: { id },
      select: { name: true, description: true, tags: true },
    });
    if (!tpl) throw new NotFoundException('模板不存在');

    const metaFallback = {
      title: tpl.name,
      description: tpl.description ?? '',
      tags: tpl.tags,
    };

    const take = limit + 1;
    const items = await this.prisma.promptVersion.findMany({
      where: { templateId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1, take } : { take }),
      select: {
        id: true,
        templateId: true,
        version: true,
        content: true,
        variables: true,
        model: true,
        temperature: true,
        maxTokens: true,
        modelConfig: true,
        metadata: true,
        changelog: true,
        operatorId: true,
        createdAt: true,
      },
    });

    let nextCursor: string | null = null;
    let slice = items;
    if (items.length > limit) {
      const extra = items[items.length - 1];
      nextCursor = extra.id;
      slice = items.slice(0, limit);
    }

    const opIds = Array.from(new Set(slice.map((v) => v.operatorId)));
    const users = (await this.prisma.user.findMany({
      where: { id: { in: opIds } },
      select: {
        id: true,
        realName: true,
        nickname: true,
        email: true,
        phone: true,
      },
    })) as UserLite[];
    const userMap = new Map<string, UserLite>(users.map((u) => [u.id, u]));

    return {
      items: slice.map((v) => {
        const u = userMap.get(v.operatorId);
        return {
          id: v.id,
          templateId: v.templateId,
          versionNo: v.version,
          content: v.content,
          variables: toVariables(v.variables),
          modelConfig: toModelConfig(v.modelConfig, {
            model: v.model,
            temperature: v.temperature,
            maxTokens: v.maxTokens,
          }),
          metadata: toMetadata(v.metadata, metaFallback),
          changelog: v.changelog ?? '',
          createdAt: toIso(v.createdAt),
          createdBy: u ? { id: u.id, name: displayName(u) } : null,
        };
      }),
      nextCursor,
    };
  }

  @Get(':id/versions/:versionId')
  async getVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    const tpl = await this.prisma.promptTemplate.findUnique({
      where: { id },
      select: { name: true, description: true, tags: true },
    });
    if (!tpl) throw new NotFoundException('模板不存在');

    const v = await this.prisma.promptVersion.findFirst({
      where: { id: versionId, templateId: id },
      select: {
        id: true,
        templateId: true,
        version: true,
        content: true,
        variables: true,
        model: true,
        temperature: true,
        maxTokens: true,
        modelConfig: true,
        metadata: true,
        changelog: true,
        operatorId: true,
        createdAt: true,
      },
    });
    if (!v) throw new NotFoundException('版本不存在');

    const u = await this.prisma.user.findUnique({
      where: { id: v.operatorId },
      select: {
        id: true,
        realName: true,
        nickname: true,
        email: true,
        phone: true,
      },
    });

    const metaFallback = {
      title: tpl.name,
      description: tpl.description ?? '',
      tags: tpl.tags,
    };

    return {
      id: v.id,
      templateId: v.templateId,
      versionNo: v.version,
      content: v.content,
      variables: toVariables(v.variables),
      modelConfig: toModelConfig(v.modelConfig, {
        model: v.model,
        temperature: v.temperature,
        maxTokens: v.maxTokens,
      }),
      metadata: toMetadata(v.metadata, metaFallback),
      changelog: v.changelog ?? '',
      createdAt: toIso(v.createdAt),
      createdBy: u ? { id: u.id, name: displayName(u) } : null,
    };
  }

  @Post(':id/test')
  async testPrompt(
    @Param('id') id: string,
    @Body() dto: RunPromptTestDto,
    @Res() res: Response,
  ) {
    const tpl = await this.prisma.promptTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tpl) throw new NotFoundException('模板不存在');

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const runId = `r_${randomUUID()}`;
    const startedAtIso = new Date().toISOString();

    const model =
      isRecord(dto.modelConfig) && typeof dto.modelConfig['model'] === 'string'
        ? String(dto.modelConfig['model'])
        : 'unknown';

    writeSse(res, 'start', { runId, model, startedAt: startedAtIso });

    const valuesRaw = dto.variableValues;
    const values: Record<string, unknown> = isRecord(valuesRaw)
      ? valuesRaw
      : {};

    const vars = Array.isArray(dto.variables) ? dto.variables : [];
    const declaredNames = vars
      .map((v) =>
        isRecord(v) && typeof v['name'] === 'string' ? String(v['name']) : null,
      )
      .filter((x): x is string => !!x);
    const declaredSet = new Set(declaredNames);

    for (const key of Object.keys(values)) {
      if (!declaredSet.has(key)) {
        writeSse(res, 'error', {
          code: 'variable_mismatch',
          message: `变量 ${key} 未声明`,
        });
        res.end();
        return;
      }
    }

    for (const v of vars) {
      if (!isRecord(v)) continue;
      const name = typeof v['name'] === 'string' ? String(v['name']) : '';
      if (!name) continue;
      const required = v['required'] === true;
      if (!required) continue;
      const val = values[name];
      const empty =
        val === null ||
        val === undefined ||
        (typeof val === 'string' && val === '');
      if (empty) {
        writeSse(res, 'error', {
          code: 'variable_mismatch',
          message: `变量 ${name} 为必填`,
        });
        res.end();
        return;
      }
    }

    const timeoutMs =
      typeof dto.timeoutMs === 'number' ? dto.timeoutMs : 60_000;
    const startedAt = Date.now();

    const metaTitle =
      isRecord(dto.metadata) && typeof dto.metadata['title'] === 'string'
        ? String(dto.metadata['title'])
        : '';

    const rendered = renderTemplate(dto.content ?? '', values);

    const fullOutput =
      `【模拟测试运行】\n` +
      (metaTitle ? `标题：${metaTitle}\n` : '') +
      `模型：${model}\n\n` +
      rendered +
      `\n\n---\n` +
      `这是一个用于联调 SSE 的模拟输出。`;

    const inputTokens = Math.ceil(
      (String(dto.content ?? '').length + JSON.stringify(values).length) / 4,
    );
    const outputTokens = Math.ceil(fullOutput.length / 4);

    let idx = 0;
    const chunkSize = 12;

    const timer = setInterval(() => {
      if (idx >= fullOutput.length) {
        clearInterval(timer);
        writeSse(res, 'usage', { inputTokens, outputTokens });
        writeSse(res, 'done', {
          finishReason: 'stop',
          durationMs: Date.now() - startedAt,
        });
        res.end();
        return;
      }
      const delta = fullOutput.slice(idx, idx + chunkSize);
      idx += chunkSize;
      writeSse(res, 'chunk', { delta });
    }, 50);

    const timeoutTimer = setTimeout(() => {
      clearInterval(timer);
      writeSse(res, 'error', { code: 'timeout', message: '请求超时' });
      res.end();
    }, timeoutMs);

    res.on('close', () => {
      clearInterval(timer);
      clearTimeout(timeoutTimer);
    });
  }

  @Post()
  async create(
    @CurrentUser('id') uid: string,
    @Body() dto: CreateAdminPromptDto,
  ) {
    const exists = await this.prisma.promptTemplate.findUnique({
      where: { code: dto.sceneKey },
      select: { id: true },
    });
    if (exists) throw new ConflictException('sceneKey 已存在，请更换');

    const tpl = await this.prisma.$transaction(async (tx) => {
      const created = await tx.promptTemplate.create({
        data: {
          code: dto.sceneKey,
          name: dto.name,
          scene: PromptScene.OTHER,
          description: dto.description || null,
          tags: dto.tags ?? [],
          content: '编辑器加载中（7A-2a）',
          variables: [],
          model: null,
          temperature: null,
          maxTokens: null,
          status: PrismaPromptStatus.DRAFT,
          currentVersion: 1,
          createdBy: uid,
          updatedBy: uid,
        },
      });

      const initModelConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2048,
      };
      const initMetadata = {
        title: created.name,
        description: created.description ?? '',
        tags: created.tags,
      };

      await tx.promptVersion.create({
        data: {
          templateId: created.id,
          version: 1,
          content: created.content,
          variables: created.variables as Prisma.InputJsonValue,
          model: initModelConfig.model,
          temperature: initModelConfig.temperature,
          maxTokens: initModelConfig.maxTokens,
          modelConfig: initModelConfig,
          metadata: initMetadata,
          changelog: 'init',
          operatorId: uid,
        },
      });

      return created;
    });

    return {
      id: tpl.id,
      sceneKey: tpl.code,
      name: tpl.name,
      description: tpl.description ?? '',
      tags: dto.tags ?? [],
      currentVersionNo: null,
      status: mapStatus(tpl.status),
      createdAt: toIso(tpl.createdAt),
      updatedAt: toIso(tpl.updatedAt),
      updatedBy: null,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const tpl = await this.prisma.promptTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tpl) throw new NotFoundException('模板不存在');
    await this.prisma.promptTemplate.delete({ where: { id } });
    return { success: true };
  }
}
