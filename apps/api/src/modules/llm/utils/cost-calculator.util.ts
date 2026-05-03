import {
  DEFAULT_PRICING_MODEL,
  MODEL_PRICING,
} from '../constants/pricing.constant';

export function calculateCostUsd(options: {
  promptTokens: number;
  completionTokens: number;
  model: string;
}): { cost: number; pricingModel: string; usedFallbackPricing: boolean } {
  const pricing =
    MODEL_PRICING[options.model] ??
    MODEL_PRICING[DEFAULT_PRICING_MODEL] ??
    null;

  if (!pricing) {
    return {
      cost: 0,
      pricingModel: DEFAULT_PRICING_MODEL,
      usedFallbackPricing: true,
    };
  }

  const inputCost = (options.promptTokens / 1000) * pricing.input;
  const outputCost = (options.completionTokens / 1000) * pricing.output;
  const cost = Number((inputCost + outputCost).toFixed(6));

  const usedFallbackPricing =
    options.model !== DEFAULT_PRICING_MODEL && !MODEL_PRICING[options.model];

  return {
    cost,
    pricingModel: MODEL_PRICING[options.model]
      ? options.model
      : DEFAULT_PRICING_MODEL,
    usedFallbackPricing,
  };
}
