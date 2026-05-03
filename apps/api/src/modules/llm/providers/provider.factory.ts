import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ILlmProvider } from '../interfaces/llm-provider.interface';
import type { LlmProviderName } from '../interfaces/llm-options.interface';
import { DeepSeekProvider } from './deepseek.provider';
import { OpenAiProvider } from './openai.provider';
import { QwenProvider } from './qwen.provider';

@Injectable()
export class ProviderFactory {
  private readonly providers: Record<LlmProviderName, ILlmProvider>;

  constructor(
    private readonly configService: ConfigService,
    openAiProvider: OpenAiProvider,
    deepSeekProvider: DeepSeekProvider,
    qwenProvider: QwenProvider,
  ) {
    this.providers = {
      openai: openAiProvider,
      deepseek: deepSeekProvider,
      qwen: qwenProvider,
    };
  }

  getDefaultProviderName(): LlmProviderName {
    const raw = (
      this.configService.get<string>('LLM_DEFAULT_PROVIDER') ?? 'deepseek'
    )
      .trim()
      .toLowerCase();

    if (raw === 'openai' || raw === 'deepseek' || raw === 'qwen') return raw;
    return 'deepseek';
  }

  getProvider(name?: LlmProviderName): ILlmProvider {
    const providerName = name ?? this.getDefaultProviderName();
    return this.providers[providerName];
  }
}
