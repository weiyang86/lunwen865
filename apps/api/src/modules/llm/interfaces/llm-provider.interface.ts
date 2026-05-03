import type { LlmOptions } from './llm-options.interface';
import type { RawLlmResponse } from './llm-response.interface';

export interface ILlmProvider {
  readonly name: string;
  readonly defaultModel: string;

  generate(prompt: string, options: LlmOptions): Promise<RawLlmResponse>;
  generateStream(prompt: string, options: LlmOptions): AsyncIterable<string>;
}
