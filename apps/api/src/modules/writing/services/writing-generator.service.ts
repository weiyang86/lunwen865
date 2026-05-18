import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { LlmOptions } from '../../llm/interfaces/llm-options.interface';
import { LlmService } from '../../llm/llm.service';
import { PromptService } from '../../prompt/prompt.service';
import type { SectionContext } from '../interfaces/writing-context.interface';
import { buildSectionVars } from '../prompts/section-generation.prompt';
import { buildSectionRetryVars } from '../prompts/section-retry.prompt';

export interface WritingGenerationDone {
  prompt: string;
  content: string;
  durationMs: number;
  estimatedTokens: number;
}

export interface WritingGenerationStream {
  stream: AsyncIterable<string>;
  done: Promise<WritingGenerationDone>;
}

@Injectable()
export class WritingGeneratorService {
  private readonly logger = new Logger(WritingGeneratorService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly promptService: PromptService,
  ) {}

  private buildFallbackSectionPrompt(
    vars: ReturnType<typeof buildSectionVars>,
  ): string {
    const keywords = vars.keywordsText?.trim() ? vars.keywordsText : '（无）';
    return `你是论文写作助手。请为论文生成“单个小节”的正文内容，要求逻辑严谨、表达学术化、避免空话套话。

## 论文类型
${vars.educationLabel}

## 论文题目
${vars.title}

## 研究方向/主题
${vars.topic}

## 关键词
${keywords}

## 章节位置
${vars.chapterTitle}

## 当前小节
- 小节标题：${vars.sectionTitle}
- 小节写作要点：${vars.sectionSummary}
- 目标字数：${vars.expectedWords}（尽量接近）

${vars.previousSummaryBlock}## 输出要求
1) 只输出正文内容，不要输出“标题：”“摘要：”等标签。
2) 不要重复小节标题作为第一行标题。
3) 如果需要引用参考文献，请使用数字引用格式，例如 [1]、[2]（可多次引用同一编号）。
4) 内容要围绕“小节写作要点”展开，包含必要的定义、论证、分析与小结，避免与其他章节重复。
`;
  }

  private buildFallbackRetryPrompt(
    vars: ReturnType<typeof buildSectionRetryVars>,
  ): string {
    const keywords = vars.keywordsText?.trim() ? vars.keywordsText : '（无）';
    return `你是论文写作助手。请根据用户反馈，重写当前小节正文内容，要求更符合学术规范与逻辑。

## 用户反馈
${vars.feedback}

## 论文类型
${vars.educationLabel}

## 论文题目
${vars.title}

## 研究方向/主题
${vars.topic}

## 关键词
${keywords}

## 章节位置
${vars.chapterTitle}

## 当前小节
- 小节标题：${vars.sectionTitle}
- 小节写作要点：${vars.sectionSummary}
- 目标字数：${vars.expectedWords}（尽量接近）

${vars.previousSummaryBlock}## 输出要求
1) 只输出正文内容，不要输出“标题：”“摘要：”等标签。
2) 不要重复小节标题作为第一行标题。
3) 针对用户反馈逐条修正（如结构、论证、语言、材料、数据、图表描述等）。
4) 如果需要引用参考文献，请使用数字引用格式，例如 [1]、[2]。
`;
  }

  async createSectionStream(params: {
    ctx: SectionContext;
    llmOptions: Omit<LlmOptions, 'temperature' | 'maxTokens'> & {
      temperature: number;
      maxTokens: number;
    };
  }): Promise<WritingGenerationStream> {
    const vars = buildSectionVars(params.ctx);
    let prompt: string;
    let model: string | null | undefined;

    try {
      const rendered = await this.promptService.render('paper.section', vars);
      prompt = rendered.content;
      model = rendered.model;
    } catch (e: unknown) {
      if (e instanceof NotFoundException || e instanceof BadRequestException) {
        this.logger.warn(`Prompt 模板不可用，使用内置兜底：paper.section`);
        prompt = this.buildFallbackSectionPrompt(vars);
        model = undefined;
      } else {
        throw e;
      }
    }
    return this.createStreamInternal(prompt, {
      ...params.llmOptions,
      model: params.llmOptions.model ?? model ?? undefined,
    });
  }

  async createRetryStream(params: {
    ctx: SectionContext;
    feedback: string;
    llmOptions: Omit<LlmOptions, 'temperature' | 'maxTokens'> & {
      temperature: number;
      maxTokens: number;
    };
  }): Promise<WritingGenerationStream> {
    const vars = buildSectionRetryVars(params.ctx, params.feedback);
    let prompt: string;
    let model: string | null | undefined;

    try {
      const rendered = await this.promptService.render(
        'paper.section.retry',
        vars,
      );
      prompt = rendered.content;
      model = rendered.model;
    } catch (e: unknown) {
      if (e instanceof NotFoundException || e instanceof BadRequestException) {
        this.logger.warn(
          `Prompt 模板不可用，使用内置兜底：paper.section.retry`,
        );
        prompt = this.buildFallbackRetryPrompt(vars);
        model = undefined;
      } else {
        throw e;
      }
    }
    return this.createStreamInternal(prompt, {
      ...params.llmOptions,
      model: params.llmOptions.model ?? model ?? undefined,
    });
  }

  private createStreamInternal(
    prompt: string,
    llmOptions: LlmOptions,
  ): WritingGenerationStream {
    let resolveDone!: (value: WritingGenerationDone) => void;
    let rejectDone!: (reason: unknown) => void;

    const done = new Promise<WritingGenerationDone>((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });

    const llm = this.llm;
    const startedAt = Date.now();

    const stream = (async function* (): AsyncIterable<string> {
      let content = '';
      try {
        for await (const chunk of llm.generateStream(prompt, llmOptions)) {
          content += chunk;
          yield chunk;
        }
        const durationMs = Date.now() - startedAt;
        const estimatedTokens = llm.estimateTokens(content);
        resolveDone({ prompt, content, durationMs, estimatedTokens });
      } catch (error: unknown) {
        rejectDone(error);
        throw error;
      }
    })();

    return { stream, done };
  }
}
