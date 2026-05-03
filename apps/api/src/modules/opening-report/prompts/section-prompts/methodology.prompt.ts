import type { GenerationContext } from '../../interfaces/generation-context.interface';
import {
  buildAcademicLevelText,
  buildAdditionalRequirements,
  buildCommonPaperInfo,
  buildPreviousSectionsContext,
} from '../prompt-context.builder';

export function buildMethodologyPrompt(ctx: GenerationContext): string {
  const levelText = buildAcademicLevelText(ctx);

  return `你是一位资深的学术写作专家，正在协助撰写一篇${levelText}的开题报告。

${buildCommonPaperInfo(ctx)}${buildPreviousSectionsContext(ctx.previousSections)}${buildAdditionalRequirements(ctx)}## 当前任务
撰写开题报告的第 5 章节：**研究方法**

## 章节定位
研究方法用于说明如何完成研究内容，强调方法选择与研究问题的匹配关系，并说明数据来源、研究步骤与可行性。

## 写作要求
1. 字数严格控制在 600-1000 字
2. 必须包含：
   - 方法组合说明（定性/定量/混合，或系统设计/实验等）
   - 数据与材料来源（对象、样本、范围、获取方式）
   - 研究步骤与流程（按阶段描述，可执行）
   - 质量控制与有效性保障（如信度效度、对照、偏差控制）
3. 行文风格：学术、客观、严谨
4. 结构建议：先说明总体方法框架，再分解关键方法
5. 输出格式：以 Markdown 二级标题开头：\`## 五、研究方法\`

## 禁止事项
- 不要写成教材式概念解释
- 不要使用第一人称
- 不要使用指代不清的转述词

## 输出
直接输出章节内容（Markdown 格式），不要任何额外说明、不要使用代码块包裹。`;
}
