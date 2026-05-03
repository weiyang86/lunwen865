import type { RefType } from '@prisma/client';

export interface ReferenceGenerationContext {
  title: string;
  outlineTitles: string[];
  contentSnippets: string[];
  count: number;
  recentYears: number;
  languageHint: { zhRatio: number; enRatio: number };
  typeDistribution: Array<{ type: RefType; ratio: number }>;
}

export function buildReferenceGenerationPrompt(
  ctx: ReferenceGenerationContext,
): string {
  const dist = ctx.typeDistribution
    .map((d) => `${d.type}:${Math.round(d.ratio * 100)}%`)
    .join(', ');

  return `你是严谨的学术研究助理。请为以下论文生成真实风格、符合学术常识的参考文献条目（先不要求可检索命中，但作者/期刊/年份/题名组合要合理，避免明显虚构痕迹）。注意：本阶段全部标记 verified=false，后续由用户核实。

## 论文信息
- 题目：${ctx.title}

## 大纲（章/节标题）
${ctx.outlineTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## 正文片段（节选）
${ctx.contentSnippets.map((s, i) => `片段${i + 1}：${s}`).join('\n\n')}

## 生成要求
- 数量：${ctx.count} 条
- 时间范围：近 ${ctx.recentYears} 年为主，必要时可包含经典文献
- 语言比例：中文约 ${Math.round(ctx.languageHint.zhRatio * 100)}%，英文约 ${Math.round(ctx.languageHint.enRatio * 100)}%
- 类型分布（尽量满足）：${dist}
- 输出必须是 JSON，且仅输出 JSON，不要包含解释文字
- 每条参考文献必须包含：type/title/authors/year（year 可为空）

## 输出 JSON 格式
{
  "references": [
    {
      "type": "JOURNAL",
      "title": "...",
      "authors": "张三, 李四",
      "year": 2023,
      "journal": "...",
      "volume": "...",
      "issue": "...",
      "pages": "12-18",
      "doi": "10.xxxx/xxxx"
    }
  ]
}`;
}
