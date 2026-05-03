import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionChunk,
} from 'openai/resources/chat/completions';
import type { ILlmProvider } from '../interfaces/llm-provider.interface';
import type { LlmOptions } from '../interfaces/llm-options.interface';
import type { RawLlmResponse } from '../interfaces/llm-response.interface';

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replaceAll('`', '');
}

function createAbortController(timeoutMs: number | undefined): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const ms = timeoutMs ?? 60_000;
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return { controller, cleanup: () => clearTimeout(timeoutId) };
}

@Injectable()
export class DeepSeekProvider implements ILlmProvider {
  public readonly name = 'deepseek';
  public readonly defaultModel: string;

  private readonly client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY') ?? '';
    const baseURL = normalizeBaseUrl(
      this.configService.get<string>('DEEPSEEK_BASE_URL'),
    );
    this.defaultModel =
      this.configService.get<string>('DEEPSEEK_DEFAULT_MODEL') ??
      'deepseek-chat';

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
  }

  async generate(prompt: string, options: LlmOptions): Promise<RawLlmResponse> {
    const { controller, cleanup } = createAbortController(options.timeout);

    try {
      const completion: ChatCompletion =
        await this.client.chat.completions.create(
          {
            model: options.model ?? this.defaultModel,
            temperature: options.temperature,
            max_tokens: options.maxTokens,
            top_p: options.topP,
            messages: options.systemPrompt
              ? [
                  { role: 'system', content: options.systemPrompt },
                  { role: 'user', content: prompt },
                ]
              : [{ role: 'user', content: prompt }],
          },
          { signal: controller.signal },
        );

      const content = completion.choices[0]?.message?.content ?? '';
      const usage = completion.usage;

      return {
        content,
        model: completion.model ?? options.model ?? this.defaultModel,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
      };
    } finally {
      cleanup();
    }
  }

  async *generateStream(
    prompt: string,
    options: LlmOptions,
  ): AsyncIterable<string> {
    const { controller, cleanup } = createAbortController(options.timeout);

    try {
      const stream = await this.client.chat.completions.create(
        {
          model: options.model ?? this.defaultModel,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          top_p: options.topP,
          stream: true,
          messages: options.systemPrompt
            ? [
                { role: 'system', content: options.systemPrompt },
                { role: 'user', content: prompt },
              ]
            : [{ role: 'user', content: prompt }],
        },
        { signal: controller.signal },
      );

      for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) yield delta;
      }
    } finally {
      cleanup();
    }
  }
}
