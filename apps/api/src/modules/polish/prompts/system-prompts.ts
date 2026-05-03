export function buildPolishSystemPrompt(params: {
  strength: 'LIGHT' | 'MEDIUM' | 'STRONG';
  mode: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
  preserveQuotes: boolean;
  preserveTerms: string[];
}): string {
  const terms = params.preserveTerms.length
    ? `必须 100% 保留以下术语原样不变：${params.preserveTerms.join('、')}。`
    : '如遇专业术语必须尽量保持原样。';

  const preserveQuotes = params.preserveQuotes
    ? '引用内容（含引用编号/引用块）不改写，仅可微调标点与空格。'
    : '可以在不改变引用含义的前提下轻微改写引用周边表述。';

  const base = [
    '你是中文学术写作润色助手，目标是降低 AI 生成痕迹，同时保持语义、专业度与连贯性。',
    '输出必须只包含改写后的正文，不要解释、不要列要点、不要加标题、不要加引号包裹。',
    '必须原样保留所有占位符：形如 [REF_001] [FORMULA_001] [CODE_001] [TERM_001]，禁止改动其字符、大小写、顺序与位置。',
    '中文标点规范，避免机械化结构（如“首先/其次/最后/综上所述”频繁出现）。',
    terms,
    preserveQuotes,
  ];

  const strengthRule =
    params.strength === 'LIGHT'
      ? '轻度改写：仅调整长句结构与少量词汇替换，不改变段落顺序，不增减观点，输出字数与输入差异控制在 ±15%。'
      : params.strength === 'MEDIUM'
        ? '中度改写：允许主被动转换、长短句拆合、增加过渡句使行文自然，尽量保持段落结构，字数差异控制在 ±25%。'
        : '重度改写：可调整段落内逻辑顺序，增加学术过渡以降低 AI 句式特征，但必须保留核心观点与论证链条，字数差异控制在 ±35%。';

  const modeRule =
    params.mode === 'CONSERVATIVE'
      ? '模式：保守（temperature 0.3）。专业术语严格保留，引用部分不改写。'
      : params.mode === 'BALANCED'
        ? '模式：平衡（temperature 0.6）。常规改写。'
        : '模式：激进（temperature 0.9）。允许对结构与逻辑顺序做更明显调整，但不得引入新观点。';

  return [...base, strengthRule, modeRule].join('\n');
}
