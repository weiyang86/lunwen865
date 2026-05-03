import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import type { PromptTemplate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { renderPrompt, type PromptVariable } from './utils/render.util';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
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

@Injectable()
export class PromptService implements OnModuleInit {
  private readonly logger = new Logger(PromptService.name);
  private cache = new Map<string, PromptTemplate>();
  private cacheTime = 0;
  private readonly CACHE_TTL = 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.warmup();
  }

  private async warmup() {
    const list = await this.prisma.promptTemplate.findMany({
      where: { status: 'ACTIVE' },
    });
    this.cache.clear();
    for (const t of list) this.cache.set(t.code, t);
    this.cacheTime = Date.now();
    this.logger.log(`[Prompt] 缓存 ${list.length} 个 ACTIVE 模板`);
  }

  async invalidate() {
    await this.warmup();
  }

  async get(code: string): Promise<PromptTemplate> {
    if (Date.now() - this.cacheTime > this.CACHE_TTL) await this.warmup();
    const cached = this.cache.get(code);
    if (cached) return cached;

    const tpl = await this.prisma.promptTemplate.findUnique({
      where: { code },
    });
    if (!tpl) throw new NotFoundException(`Prompt 模板不存在: ${code}`);
    if (tpl.status !== 'ACTIVE')
      throw new BadRequestException(`Prompt 模板未启用: ${code}`);
    this.cache.set(code, tpl);
    return tpl;
  }

  async render(
    code: string,
    vars: Record<string, unknown> = {},
  ): Promise<{
    content: string;
    model?: string | null;
    temperature?: number | null;
    maxTokens?: number | null;
  }> {
    const tpl = await this.get(code);
    const declared = parsePromptVariables(tpl.variables);
    const content = renderPrompt(tpl.content, declared, vars);
    return {
      content,
      model: tpl.model,
      temperature: tpl.temperature,
      maxTokens: tpl.maxTokens,
    };
  }
}
