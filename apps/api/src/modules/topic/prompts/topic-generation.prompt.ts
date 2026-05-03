type AcademicLevel = 'UNDERGRADUATE' | 'MASTER' | 'DOCTOR';

export function buildTopicGenerationPrompt(params: {
  topic: string;
  keywords: string[];
  academicLevel: AcademicLevel;
  language: string;
  count: number;
  additionalContext?: string;
  feedback?: string;
  rejectedTitles?: string[];
  preferredStyle?: string;
}): string {
  const levelMap: Record<AcademicLevel, string> = {
    UNDERGRADUATE: '本科',
    MASTER: '硕士',
    DOCTOR: '博士',
  };

  const lang = (params.language || 'zh-CN').toLowerCase();
  const isEnglish = lang.startsWith('en');

  const keywordsText =
    params.keywords.length > 0 ? params.keywords.join('、') : '（无）';

  const rejectedText =
    params.rejectedTitles && params.rejectedTitles.length > 0
      ? params.rejectedTitles.map((t) => `- ${t}`).join('\n')
      : '（无）';

  const additionalContextText = params.additionalContext?.trim()
    ? params.additionalContext.trim()
    : '（无）';

  const feedbackText = params.feedback?.trim()
    ? params.feedback.trim()
    : '（无）';

  const preferredStyleText = params.preferredStyle?.trim()
    ? params.preferredStyle.trim()
    : '（无）';

  if (isEnglish) {
    return [
      '## Task',
      `Generate ${params.count} academic paper title candidates based on the input topic, keywords, and academic level.`,
      '',
      '## Input',
      `- Topic: ${params.topic}`,
      `- Keywords: ${keywordsText}`,
      `- Academic Level: ${params.academicLevel}`,
      `- Preferred Style: ${preferredStyleText}`,
      `- Additional Context: ${additionalContextText}`,
      `- Feedback (if any): ${feedbackText}`,
      `- Rejected Titles (avoid similar):`,
      rejectedText,
      '',
      '## Constraints',
      '- Output MUST be valid JSON only. Do NOT include markdown code fences.',
      '- Titles should match the academic level depth (UG: applied, Master: method/system, Doctor: novel/theoretical).',
      '- Avoid overly broad or overly narrow titles.',
      '- Avoid duplicates and avoid being too similar to rejected titles.',
      '- Provide rationale and estimated difficulty for each title.',
      '',
      '## Output Format (JSON Example)',
      '{',
      '  "candidates": [',
      '    {',
      '      "title": "Title A (placeholder)",',
      '      "rationale": "Why this title is strong (placeholder)",',
      '      "keywords": ["keyword1", "keyword2"],',
      '      "estimatedDifficulty": "MEDIUM"',
      '    }',
      '  ]',
      '}',
      '',
      'Now produce the JSON result.',
    ].join('\n');
  }

  return [
    '## 任务',
    `基于用户主题、关键词与学术等级，生成 ${params.count} 个论文题目候选。`,
    '',
    '## 输入',
    `- 主题（topic）：${params.topic}`,
    `- 关键词（keywords）：${keywordsText}`,
    `- 学术等级（academicLevel）：${levelMap[params.academicLevel]}（${params.academicLevel}）`,
    `- 语言（language）：${params.language || 'zh-CN'}`,
    `- 偏好风格（preferredStyle）：${preferredStyleText}`,
    `- 额外上下文（additionalContext）：${additionalContextText}`,
    `- 用户反馈（feedback）：${feedbackText}`,
    `- 历史拒绝题目（rejectedTitles，必须避免相似）：`,
    rejectedText,
    '',
    '## 约束',
    '1. 必须只输出 JSON，不要包含 markdown 代码块标记。',
    '2. 题目深度需匹配学术等级：本科偏应用，硕士偏方法/系统，博士偏理论/创新。',
    '3. 题目应具体明确，避免过宽泛或过口号化。',
    '4. 候选题目之间不得重复；必须尽量避免与 rejectedTitles 相似。',
    '5. 每个题目必须包含 rationale（亮点/为什么值得做）。',
    '6. 每个题目必须包含 estimatedDifficulty（EASY/MEDIUM/HARD）。',
    '7. keywords 字段为该题目的关键词数组（2~8 个），可以基于输入关键词调整。',
    '',
    '## 输出格式（JSON 示例）',
    '{',
    '  "candidates": [',
    '    {',
    '      "title": "题目A（占位符）",',
    '      "rationale": "为什么这个题目好（占位符）",',
    '      "keywords": ["关键词1", "关键词2"],',
    '      "estimatedDifficulty": "MEDIUM"',
    '    }',
    '  ]',
    '}',
    '',
    '## 现在开始输出 JSON 结果',
  ].join('\n');
}
