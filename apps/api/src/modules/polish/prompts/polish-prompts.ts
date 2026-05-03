import { PolishMode, PolishStrength } from '@prisma/client';
import { buildPolishSystemPrompt } from './system-prompts';

export function getPolishPrompt(params: {
  strength: PolishStrength;
  mode: PolishMode;
  preserveQuotes: boolean;
  preserveTerms: string[];
  text: string;
}): { systemPrompt: string; templateCode: string; vars: { text: string } } {
  const systemPrompt = buildPolishSystemPrompt({
    strength: params.strength,
    mode: params.mode,
    preserveQuotes: params.preserveQuotes,
    preserveTerms: params.preserveTerms,
  });

  return {
    systemPrompt,
    templateCode: 'polish.academic',
    vars: { text: params.text },
  };
}
