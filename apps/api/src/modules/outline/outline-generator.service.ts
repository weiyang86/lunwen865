import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { PromptService } from '../prompt/prompt.service';
import { InvalidTreeStructureException } from './exceptions/invalid-tree-structure.exception';
import type { OutlineNodeRecord } from './interfaces/outline-tree.interface';
import type {
  LlmOutlineNode,
  LlmOutlineResponse,
} from './interfaces/llm-outline-schema.interface';
import {
  LLM_OUTLINE_NODE_SCHEMA,
  OUTLINE_JSON_SCHEMA,
} from './interfaces/llm-outline-schema.interface';
import type { OutlineGenerationContext } from './prompts/outline-generation.prompt';
import type { SectionRegenerationContext } from './prompts/section-regeneration.prompt';
import {
  buildOutlineGenerationVars,
  buildSectionRegenerationVars,
} from './prompts';

function buildFallbackOutlinePrompt(
  vars: ReturnType<typeof buildOutlineGenerationVars>,
): string {
  return `你是论文写作助手。请基于以下信息生成论文目录/大纲，输出必须为 JSON 且严格符合给定结构要求。

## 论文类型
${vars.academicLevelText}

## 论文题目
${vars.title}

## 研究方向/主题
${vars.topic}

## 关键词
${vars.keywordsText}

## 目标总字数
${vars.targetWordCount}

## 开题报告（摘要截断）
${vars.openingReportTruncated}

${vars.additionalRequirementsBlock}## 结构要求（必须严格满足）
1) 返回 JSON 对象，根字段必须是 chapters（数组）。
2) chapters 数量必须在 4-8 章之间。
3) 每一章必须包含 children，且 children 数量必须在 2-8 之间。
4) children 代表最终正文生成的小节，必须包含 expectedWords（整数），范围 200-3000。
5) 所有 title 2-50 字，summary 20-300 字；summary 要说明本节写什么、用什么方法/数据、预期产出。
6) expectedWords 的总体分配要尽量贴近目标总字数，且每章字数分配要相对均衡。
7) 目录层级最大深度为 ${vars.maxDepth}（章=depth1，节=depth2；如需要可扩展到更深，但不要超过 maxDepth）。

## 输出 JSON 示例（仅示意，不要输出注释）
{
  "chapters": [
    { "title": "第一章 …", "summary": "…", "children": [ { "title": "1.1 …", "summary": "…", "expectedWords": 800 } ] }
  ]
}
`;
}

function buildFallbackSectionRegenPrompt(
  vars: ReturnType<typeof buildSectionRegenerationVars>,
): string {
  return `你是论文写作助手。请基于以下信息，为“当前节点”重新生成一个结构化子树节点，输出必须为 JSON 且符合节点结构。

## 论文类型
${vars.academicLevelText}

## 论文题目
${vars.paperTitle}

## 研究方向/主题
${vars.topic}

## 关键词
${vars.keywordsText}

## 目标总字数
${vars.targetWordCount}

## 大纲骨架（截断）
${vars.outlineSkeletonTruncated}

## 当前节点
- 标题：${vars.currentNodeTitle}
- 深度：${vars.currentNodeDepth}（最大深度：${vars.outlineMaxDepth}）
- 节点摘要：${vars.currentNodeSummaryText}

## 同级节点参考
${vars.siblingsText}

${vars.feedbackBlock}${vars.additionalRequirementsBlock}## 结构要求（必须严格满足）
1) 返回 JSON 对象，字段包含 title、summary，可选 expectedWords，可选 children。
2) title 2-50 字，summary 20-300 字。
3) 如果当前节点深度 < 最大深度，且需要细化，则生成 children；children 每个节点同样遵循结构要求。
4) 如果生成 children，则叶子 children 必须包含 expectedWords（整数，200-3000）。
5) summary 要清晰说明写作内容、论证路径、数据/案例来源（如有）、预期产出。

## 输出 JSON 示例（仅示意，不要输出注释）
{ "title": "…", "summary": "…", "children": [ { "title": "…", "summary": "…", "expectedWords": 600 } ] }
`;
}

@Injectable()
export class OutlineGeneratorService {
  private readonly logger = new Logger(OutlineGeneratorService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly promptService: PromptService,
  ) {}

  /**
   * 基于上下文生成整棵大纲（结构化 JSON）
   */
  async generateOutlineFromContext(
    context: OutlineGenerationContext,
  ): Promise<LlmOutlineResponse> {
    const vars = buildOutlineGenerationVars(context);
    let prompt: string;
    let model: string | null | undefined;
    let temperature: number | null | undefined;
    let maxTokens: number | null | undefined;

    try {
      const rendered = await this.promptService.render('paper.outline', vars);
      prompt = rendered.content;
      model = rendered.model;
      temperature = rendered.temperature;
      maxTokens = rendered.maxTokens;
    } catch (e: unknown) {
      if (e instanceof NotFoundException || e instanceof BadRequestException) {
        prompt = buildFallbackOutlinePrompt(vars);
      } else {
        throw e;
      }
    }
    try {
      return await this.llmService.generateJson<LlmOutlineResponse>(
        prompt,
        OUTLINE_JSON_SCHEMA,
        {
          taskId: context.taskId,
          stage: 'OUTLINE',
          model: context.model ?? model ?? undefined,
          temperature: context.temperature ?? temperature ?? undefined,
          maxTokens: context.maxTokens ?? maxTokens ?? undefined,
          maxRetries: context.maxRetries,
          timeout: context.timeout,
        },
      );
    } catch (error: unknown) {
      this.logger.error('LLM 生成大纲失败', error);
      throw new InvalidTreeStructureException(
        'LLM 返回的数据无法解析为大纲结构',
      );
    }
  }

  /**
   * 重生成某个节点的子树（返回 LLM 节点结构）
   */
  async regenerateSubtree(
    node: OutlineNodeRecord,
    context: SectionRegenerationContext,
  ): Promise<LlmOutlineNode> {
    const vars = buildSectionRegenerationVars(context);
    let prompt: string;
    let model: string | null | undefined;
    let temperature: number | null | undefined;
    let maxTokens: number | null | undefined;

    try {
      const rendered = await this.promptService.render(
        'paper.outline.section_regen',
        vars,
      );
      prompt = rendered.content;
      model = rendered.model;
      temperature = rendered.temperature;
      maxTokens = rendered.maxTokens;
    } catch (e: unknown) {
      if (e instanceof NotFoundException || e instanceof BadRequestException) {
        prompt = buildFallbackSectionRegenPrompt(vars);
      } else {
        throw e;
      }
    }
    try {
      return await this.llmService.generateJson<LlmOutlineNode>(
        prompt,
        LLM_OUTLINE_NODE_SCHEMA,
        {
          taskId: context.taskId,
          stage: 'OUTLINE',
          targetId: node.id,
          model: context.model ?? model ?? undefined,
          temperature: context.temperature ?? temperature ?? undefined,
          maxTokens: context.maxTokens ?? maxTokens ?? undefined,
          maxRetries: context.maxRetries,
          timeout: context.timeout,
        },
      );
    } catch (error: unknown) {
      this.logger.error('LLM 重生成子树失败', error);
      throw new InvalidTreeStructureException(
        'LLM 返回的数据无法解析为节点子树',
      );
    }
  }
}
