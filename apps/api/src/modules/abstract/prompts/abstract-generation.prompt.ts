type AbstractPromptContext = {
  title: string;
  topic: string;
  outlineText: string;
  wordCountTarget: number | null;
  previousZh?: string | null;
  previousEn?: string | null;
  feedback?: string | null;
};

export function buildAbstractGenerationPrompt(
  ctx: AbstractPromptContext,
): string {
  const title = ctx.title.trim();
  const topic = ctx.topic.trim();
  const outline = ctx.outlineText.trim();
  const wc =
    typeof ctx.wordCountTarget === 'number' &&
    Number.isFinite(ctx.wordCountTarget)
      ? String(Math.floor(ctx.wordCountTarget))
      : '未指定';
  const feedback = (ctx.feedback ?? '').trim();
  const prevZh = (ctx.previousZh ?? '').trim();
  const prevEn = (ctx.previousEn ?? '').trim();

  return [
    '你是论文写作助手。请生成论文摘要，必须同时包含中文摘要与英文摘要。',
    '',
    `论文题目：${title || '未命名'}`,
    `研究主题/题目方向：${topic || '未提供'}`,
    `目标字数：${wc}`,
    '',
    '目录/大纲：',
    outline ? outline : '（未提供大纲）',
    '',
    prevZh || prevEn
      ? [
          '已有摘要（用于改写/优化）：',
          prevZh ? `中文摘要：\n${prevZh}` : '',
          prevEn ? `英文摘要：\n${prevEn}` : '',
          '',
        ]
          .filter(Boolean)
          .join('\n')
      : '',
    feedback
      ? [
          '导师/用户建议（必须优先采纳，不满足则重新生成）：',
          feedback,
          '',
        ].join('\n')
      : '',
    '输出要求：',
    '1) 严格输出 JSON（不要 markdown 代码块），形如：{"abstractZh":"...","abstractEn":"..."}',
    '2) 中文摘要约 300-500 字，英文摘要约 150-250 词（可根据题目适度调整，但不要过短）',
    '3) 内容应包含：研究背景/目的、方法或思路、主要结论或贡献，语言学术化，避免口语',
    '4) 英文摘要需语法通顺、术语一致，尽量与中文内容对应',
  ]
    .filter(Boolean)
    .join('\n');
}
