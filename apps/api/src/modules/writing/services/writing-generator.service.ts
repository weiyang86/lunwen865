import { Injectable } from '@nestjs/common';
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
  constructor(
    private readonly llm: LlmService,
    private readonly promptService: PromptService,
  ) {}

  async createSectionStream(params: {
    ctx: SectionContext;
    llmOptions: Omit<LlmOptions, 'temperature' | 'maxTokens'> & {
      temperature: number;
      maxTokens: number;
    };
  }): Promise<WritingGenerationStream> {
    const { content: prompt, model } = await this.promptService.render(
      'paper.section',
      buildSectionVars(params.ctx),
    );
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
    const { content: prompt, model } = await this.promptService.render(
      'paper.section.retry',
      buildSectionRetryVars(params.ctx, params.feedback),
    );
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
