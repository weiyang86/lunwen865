export type LlmProviderName = 'openai' | 'deepseek' | 'qwen';

export type GenerationStageName =
  | 'TOPIC'
  | 'OPENING'
  | 'OUTLINE'
  | 'CHAPTER'
  | 'SECTION'
  | 'SUMMARY';

export interface LlmOptions {
  provider?: LlmProviderName;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  systemPrompt?: string;

  taskId: string;
  stage: GenerationStageName;
  targetId?: string;

  maxRetries?: number;
  timeout?: number;
}
