export const MODEL_PRICING: Record<string, { input: number; output: number }> =
  {
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'deepseek-chat': { input: 0.00027, output: 0.0011 },
    'deepseek-reasoner': { input: 0.00055, output: 0.00219 },
    'qwen-plus': { input: 0.0004, output: 0.0012 },
    'qwen-max': { input: 0.0024, output: 0.0096 },
    'qwen-turbo': { input: 0.00005, output: 0.0002 },
  };

export const DEFAULT_PRICING_MODEL = 'gpt-4o-mini';
