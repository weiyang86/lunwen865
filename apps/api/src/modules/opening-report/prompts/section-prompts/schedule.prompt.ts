import type { GenerationContext } from '../../interfaces/generation-context.interface';
import {
  buildAcademicLevelText,
  buildAdditionalRequirements,
  buildCommonPaperInfo,
  buildPreviousSectionsContext,
} from '../prompt-context.builder';

export function buildSchedulePrompt(ctx: GenerationContext): string {
  const levelText = buildAcademicLevelText(ctx);

  return `你是一位资深的学术写作专家，正在协助撰写一篇${levelText}的开题报告。

${buildCommonPaperInfo(ctx)}${buildPreviousSectionsContext(ctx.previousSections)}${buildAdditionalRequirements(ctx)}## 当前任务
撰写开题报告的第 6 章节：**研究进度安排**

## 章节定位
研究进度安排用于给出可执行的研究计划，体现研究过程的阶段性、里程碑与交付物，与研究内容和研究方法保持一致。

## 写作要求
1. 字数严格控制在 400-600 字
2. 必须输出一个 Markdown 表格，包含：
   - 阶段/时间范围
   - 主要任务
   - 产出物
3. 计划必须覆盖从资料收集到最终定稿的全流程，阶段数量建议 6-8 个
4. 行文风格：学术、客观、严谨
5. 输出格式：以 Markdown 二级标题开头：\`## 六、研究进度安排\`

## 禁止事项
- 不要出现具体日期，使用“第1-2周”这类相对时间表达
- 不要使用第一人称
- 不要使用指代不清的转述词

## 输出
直接输出章节内容（Markdown 格式），不要任何额外说明、不要使用代码块包裹。`;
}
