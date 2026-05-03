import { Injectable, Logger } from '@nestjs/common';
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
    const {
      content: prompt,
      model,
      temperature,
      maxTokens,
    } = await this.promptService.render(
      'paper.outline',
      buildOutlineGenerationVars(context),
    );
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
    const {
      content: prompt,
      model,
      temperature,
      maxTokens,
    } = await this.promptService.render(
      'paper.outline.section_regen',
      buildSectionRegenerationVars(context),
    );
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
