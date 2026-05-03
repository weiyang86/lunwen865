import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PromptScene, PromptStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptService } from './prompt.service';
import type { CreatePromptDto } from './dto/create-prompt.dto';
import type { PublishPromptDto } from './dto/publish-prompt.dto';
import type { QueryPromptDto } from './dto/query-prompt.dto';
import type { UpdatePromptDto } from './dto/update-prompt.dto';
import { diffLines } from './utils/diff.util';
import { renderPrompt, type PromptVariable } from './utils/render.util';

type PromptVariableJson = {
  name: string;
  label?: string;
  required?: boolean;
  defaultValue?: string;
  description?: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function toPromptVariableJson(
  vars: Array<{
    name: string;
    label?: string;
    required?: boolean;
    defaultValue?: string;
    description?: string;
  }>,
): PromptVariableJson[] {
  return vars.map((v) => ({
    name: v.name,
    label: v.label,
    required: v.required,
    defaultValue: v.defaultValue,
    description: v.description,
  }));
}

function parsePromptVariables(raw: unknown): PromptVariable[] {
  if (!Array.isArray(raw)) return [];
  const out: PromptVariable[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const name = item['name'];
    if (typeof name !== 'string' || name.length === 0) continue;
    const v: PromptVariable = { name };
    const label = item['label'];
    const required = item['required'];
    const defaultValue = item['defaultValue'];
    const description = item['description'];
    if (typeof label === 'string') v.label = label;
    if (typeof required === 'boolean') v.required = required;
    if (typeof defaultValue === 'string') v.defaultValue = defaultValue;
    if (typeof description === 'string') v.description = description;
    out.push(v);
  }
  return out;
}

function pickUpdateFields(
  dto: UpdatePromptDto,
): Prisma.PromptTemplateUpdateInput {
  const out: Prisma.PromptTemplateUpdateInput = {};
  if (dto.name !== undefined) out.name = dto.name;
  if (dto.scene !== undefined) out.scene = dto.scene;
  if (dto.description !== undefined) out.description = dto.description;
  if (dto.content !== undefined) out.content = dto.content;
  if (dto.variables !== undefined) {
    out.variables = toPromptVariableJson(dto.variables);
  }
  if (dto.model !== undefined) out.model = dto.model;
  if (dto.temperature !== undefined) out.temperature = dto.temperature;
  if (dto.maxTokens !== undefined) out.maxTokens = dto.maxTokens;
  return out;
}

@Injectable()
export class AdminPromptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptService: PromptService,
  ) {}

  async list(q: QueryPromptDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;

    const where: Prisma.PromptTemplateWhereInput = {};
    if (q.scene) where.scene = q.scene;
    if (q.status) where.status = q.status;
    if (q.keyword) {
      where.OR = [
        { code: { contains: q.keyword, mode: 'insensitive' } },
        { name: { contains: q.keyword, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.promptTemplate.count({ where }),
      this.prisma.promptTemplate.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const tpl = await this.prisma.promptTemplate.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!tpl) throw new NotFoundException('模板不存在');
    return tpl;
  }

  async create(operatorId: string, dto: CreatePromptDto) {
    return this.prisma.$transaction(async (tx) => {
      const exists = await tx.promptTemplate.findUnique({
        where: { code: dto.code },
        select: { id: true },
      });
      if (exists) throw new BadRequestException('code 已存在');

      const tpl = await tx.promptTemplate.create({
        data: {
          code: dto.code,
          name: dto.name,
          scene: dto.scene,
          description: dto.description ?? null,
          content: dto.content,
          variables: toPromptVariableJson(dto.variables),
          model: dto.model ?? null,
          temperature: dto.temperature ?? null,
          maxTokens: dto.maxTokens ?? null,
          status: PromptStatus.DRAFT,
          currentVersion: 1,
          createdBy: operatorId,
          updatedBy: operatorId,
        },
      });

      await tx.promptVersion.create({
        data: {
          templateId: tpl.id,
          version: 1,
          content: tpl.content,
          variables: tpl.variables as Prisma.InputJsonValue,
          model: tpl.model,
          temperature: tpl.temperature,
          maxTokens: tpl.maxTokens,
          changelog: 'init',
          operatorId,
        },
      });

      return tpl;
    });
  }

  async update(operatorId: string, id: string, dto: UpdatePromptDto) {
    return this.prisma.$transaction(async (tx) => {
      const tpl = await tx.promptTemplate.findUnique({ where: { id } });
      if (!tpl) throw new NotFoundException('模板不存在');

      const newVersion = tpl.currentVersion + 1;
      const nextContent = dto.content ?? tpl.content;
      const nextVariables: Prisma.InputJsonValue =
        dto.variables !== undefined
          ? toPromptVariableJson(dto.variables)
          : (tpl.variables as Prisma.InputJsonValue);
      const nextModel = dto.model ?? tpl.model;
      const nextTemperature = dto.temperature ?? tpl.temperature;
      const nextMaxTokens = dto.maxTokens ?? tpl.maxTokens;

      await tx.promptVersion.create({
        data: {
          templateId: tpl.id,
          version: newVersion,
          content: nextContent,
          variables: nextVariables,
          model: nextModel,
          temperature: nextTemperature,
          maxTokens: nextMaxTokens,
          changelog: dto.changelog ?? null,
          operatorId,
        },
      });

      return tx.promptTemplate.update({
        where: { id },
        data: {
          ...pickUpdateFields(dto),
          currentVersion: newVersion,
          updatedBy: operatorId,
        },
      });
    });
  }

  async publish(operatorId: string, id: string, dto: PublishPromptDto) {
    const hasUpdatePayload = Object.keys(pickUpdateFields(dto)).length > 0;
    if (hasUpdatePayload) {
      await this.update(operatorId, id, dto);
    }
    await this.prisma.promptTemplate.update({
      where: { id },
      data: { status: PromptStatus.ACTIVE, updatedBy: operatorId },
    });
    await this.promptService.invalidate();
    return this.findOne(id);
  }

  async archive(operatorId: string, id: string) {
    await this.prisma.promptTemplate.update({
      where: { id },
      data: { status: PromptStatus.ARCHIVED, updatedBy: operatorId },
    });
    await this.promptService.invalidate();
    return this.findOne(id);
  }

  async versions(id: string) {
    const tpl = await this.prisma.promptTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tpl) throw new NotFoundException('模板不存在');
    return this.prisma.promptVersion.findMany({
      where: { templateId: id },
      orderBy: { version: 'desc' },
    });
  }

  async versionDetail(id: string, version: number) {
    const ver = await this.prisma.promptVersion.findUnique({
      where: { templateId_version: { templateId: id, version } },
    });
    if (!ver) throw new NotFoundException('版本不存在');
    return ver;
  }

  async diff(id: string, from: number, to: number) {
    const [v1, v2] = await Promise.all([
      this.prisma.promptVersion.findUnique({
        where: { templateId_version: { templateId: id, version: from } },
      }),
      this.prisma.promptVersion.findUnique({
        where: { templateId_version: { templateId: id, version: to } },
      }),
    ]);
    if (!v1 || !v2) throw new NotFoundException('版本不存在');
    return {
      from: { version: from, content: v1.content },
      to: { version: to, content: v2.content },
      diff: diffLines(v1.content, v2.content),
    };
  }

  async restore(operatorId: string, id: string, version: number) {
    const ver = await this.prisma.promptVersion.findUnique({
      where: { templateId_version: { templateId: id, version } },
    });
    if (!ver) throw new NotFoundException('版本不存在');
    await this.update(operatorId, id, {
      content: ver.content,
      variables: toPromptVariableJson(parsePromptVariables(ver.variables)),
      model: ver.model ?? undefined,
      temperature: ver.temperature ?? undefined,
      maxTokens: ver.maxTokens ?? undefined,
      changelog: `回滚自 v${version}`,
    });
    return this.findOne(id);
  }

  private extractUsedVariables(template: string): string[] {
    const out = new Set<string>();
    const re = /\{\{\s*(\w+)\s*\}\}/g;
    for (;;) {
      const m = re.exec(template);
      if (!m) break;
      out.add(m[1]);
    }
    return Array.from(out);
  }

  private detectMissing(
    template: string,
    vars: Record<string, unknown>,
    declared: Array<{
      name: string;
      required?: boolean;
      defaultValue?: unknown;
    }>,
  ): string[] {
    const used = this.extractUsedVariables(template);
    const declMap = new Map(declared.map((d) => [d.name, d]));
    const missing: string[] = [];
    for (const name of used) {
      if (vars[name] !== undefined && vars[name] !== '') continue;
      const decl = declMap.get(name);
      const hasDefault = decl?.defaultValue !== undefined;
      const required = decl?.required === true;
      if (required && !hasDefault) missing.push(name);
    }
    return missing;
  }

  async testRender(id: string, vars: Record<string, unknown>) {
    const tpl = await this.prisma.promptTemplate.findUnique({ where: { id } });
    if (!tpl) throw new NotFoundException('模板不存在');
    const declared = parsePromptVariables(tpl.variables);
    try {
      const content = renderPrompt(tpl.content, declared, vars ?? {});
      return {
        success: true,
        content,
        length: content.length,
        missingVars: this.detectMissing(tpl.content, vars ?? {}, declared),
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  async remove(id: string) {
    const tpl = await this.prisma.promptTemplate.findUnique({ where: { id } });
    if (!tpl) throw new NotFoundException('模板不存在');
    if (tpl.status !== PromptStatus.DRAFT)
      throw new BadRequestException('仅 DRAFT 状态可删除');
    await this.prisma.promptTemplate.delete({ where: { id } });
    return { success: true };
  }

  sceneLabel(scene: PromptScene): string {
    const map: Partial<Record<PromptScene, string>> = {
      [PromptScene.PAPER_OUTLINE]: '论文-大纲',
      [PromptScene.PAPER_SECTION]: '论文-正文小节',
      [PromptScene.PAPER_ABSTRACT]: '论文-摘要',
      [PromptScene.POLISH_ACADEMIC]: '润色-学术',
      [PromptScene.POLISH_FLUENT]: '润色-流畅',
      [PromptScene.POLISH_TRANSLATE]: '润色-翻译',
      [PromptScene.EXPORT_TITLE]: '导出-标题',
      [PromptScene.AI_CHAT]: '对话',
      [PromptScene.OTHER]: '其他',
    };
    return map[scene] ?? String(scene);
  }
}
