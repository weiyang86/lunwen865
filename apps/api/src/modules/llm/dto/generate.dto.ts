import { z } from 'zod';

export const LlmProviderSchema = z.enum(['openai', 'deepseek', 'qwen']);

export const GenerateDtoSchema = z.object({
  prompt: z.string().min(1),
  taskId: z.string().min(1),
  stage: z.string().min(1),
  provider: LlmProviderSchema.optional(),
  model: z.string().min(1).optional(),
});

export type GenerateDto = z.infer<typeof GenerateDtoSchema>;

export const GenerateJsonDtoSchema = z.object({
  prompt: z.string().min(1),
  taskId: z.string().min(1),
  stage: z.string().min(1),
  provider: LlmProviderSchema.optional(),
  model: z.string().min(1).optional(),
});

export type GenerateJsonDto = z.infer<typeof GenerateJsonDtoSchema>;
