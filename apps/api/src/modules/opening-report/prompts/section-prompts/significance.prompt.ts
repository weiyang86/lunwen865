import type { GenerationContext } from '../../interfaces/generation-context.interface';
import {
  buildAcademicLevelText,
  buildAdditionalRequirements,
  buildCommonPaperInfo,
  buildPreviousSectionsContext,
} from '../prompt-context.builder';

export function buildSignificancePrompt(ctx: GenerationContext): string {
  const levelText = buildAcademicLevelText(ctx);

  return `你是一位资深的学术写作专家，正在协助撰写一篇${levelText}的开题报告。

${buildCommonPaperInfo(ctx)}${buildPreviousSectionsContext(ctx.previousSections)}${buildAdditionalRequirements(ctx)}## 当前任务
撰写开题报告的第 2 章节：**研究意义**

## 章节定位
研究意义用于回答“为什么要做这项研究”，需要从理论价值与实践价值两个维度给出清晰、可检验的论证，并与研究背景形成承接。

## 写作要求
1. 字数严格控制在 500-800 字
2. 内容必须包含两个小部分：
   - 理论意义：对相关研究领域的补充、深化或方法改进
   - 实践意义：对行业、组织或教学/管理实践的可落地价值
3. 行文风格：学术、客观、严谨，避免口号式表达
4. 结构建议：2-3 段，每段只解决一个核心论点
5. 输出格式：以 Markdown 二级标题开头：\`## 二、研究意义\`

## 禁止事项
- 不要泛泛而谈“具有重要意义”
- 不要引入新主题偏离论文题目
- 不要使用第一人称
- 不要使用指代不清的转述词

## 输出
直接输出章节内容（Markdown 格式），不要任何额外说明、不要使用代码块包裹。`;
}
