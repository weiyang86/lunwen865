import type { GenerationContext } from '../../interfaces/generation-context.interface';
import {
  buildAcademicLevelText,
  buildAdditionalRequirements,
  buildCommonPaperInfo,
  buildPreviousSectionsContext,
} from '../prompt-context.builder';

export function buildLiteratureReviewPrompt(ctx: GenerationContext): string {
  const levelText = buildAcademicLevelText(ctx);

  return `你是一位资深的学术写作专家，正在协助撰写一篇${levelText}的开题报告。

${buildCommonPaperInfo(ctx)}${buildPreviousSectionsContext(ctx.previousSections)}${buildAdditionalRequirements(ctx)}## 当前任务
撰写开题报告的第 3 章节：**文献综述**

## 章节定位
文献综述用于梳理与论文题目相关的研究进展与典型观点，归纳研究脉络，指出研究空白与争议点，为研究内容与研究方法提供依据。

## 写作要求
1. 字数严格控制在 1000-1500 字
2. 综述结构必须体现“主题归类 + 对比评述”：
   - 至少划分 3 个主题维度进行综述
   - 每个维度都要做观点归纳与优缺点评述
3. 必须包含“研究不足与改进方向”小段，明确指出本研究的切入点
4. 行文风格：学术、客观、严谨，避免堆砌概念
5. 输出格式：以 Markdown 二级标题开头：\`## 三、文献综述\`

## 禁止事项
- 不要编造具体作者姓名、期刊名与年份
- 不要罗列参考文献清单
- 不要使用第一人称
- 不要使用指代不清的转述词

## 输出
直接输出章节内容（Markdown 格式），不要任何额外说明、不要使用代码块包裹。`;
}
