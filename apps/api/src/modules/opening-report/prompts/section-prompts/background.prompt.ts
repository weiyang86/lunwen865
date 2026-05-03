import type { GenerationContext } from '../../interfaces/generation-context.interface';
import {
  buildAcademicLevelText,
  buildAdditionalRequirements,
  buildCommonPaperInfo,
  buildPreviousSectionsContext,
} from '../prompt-context.builder';

export function buildBackgroundPrompt(ctx: GenerationContext): string {
  const levelText = buildAcademicLevelText(ctx);

  return `你是一位资深的学术写作专家，正在协助撰写一篇${levelText}的开题报告。

${buildCommonPaperInfo(ctx)}${buildPreviousSectionsContext(ctx.previousSections)}${buildAdditionalRequirements(ctx)}## 当前任务
撰写开题报告的第 1 章节：**研究背景**

## 章节定位
研究背景是开题报告的开篇，旨在阐明研究领域的现状、问题来源和研究的必要性，为后续章节建立清晰的问题场景。

## 写作要求
1. 字数严格控制在 600-1000 字
2. 内容必须覆盖：
   - 研究领域的发展现状（结合时代与行业背景）
   - 现阶段存在的关键问题或挑战（清晰具体）
   - 对问题的影响与研究的必要性（强调现实意义）
3. 行文风格：学术、客观、严谨，避免口语化与情绪化表达
4. 段落结构：建议 3-4 段，逻辑递进，段落主题明确
5. 输出格式：以 Markdown 二级标题开头：\`## 一、研究背景\`

## 禁止事项
- 不要罗列文献条目或引用列表（文献综述章节再处理）
- 不要使用第一人称
- 不要在段首使用机械连接词
- 不要使用指代不清的转述词

## 输出
直接输出章节内容（Markdown 格式），不要任何额外说明、不要使用代码块包裹。`;
}
