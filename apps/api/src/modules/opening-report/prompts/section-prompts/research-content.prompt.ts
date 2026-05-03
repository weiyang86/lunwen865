import type { GenerationContext } from '../../interfaces/generation-context.interface';
import {
  buildAcademicLevelText,
  buildAdditionalRequirements,
  buildCommonPaperInfo,
  buildPreviousSectionsContext,
} from '../prompt-context.builder';

export function buildResearchContentPrompt(ctx: GenerationContext): string {
  const levelText = buildAcademicLevelText(ctx);

  return `你是一位资深的学术写作专家，正在协助撰写一篇${levelText}的开题报告。

${buildCommonPaperInfo(ctx)}${buildPreviousSectionsContext(ctx.previousSections)}${buildAdditionalRequirements(ctx)}## 当前任务
撰写开题报告的第 4 章节：**研究内容**

## 章节定位
研究内容用于明确本研究要解决的核心问题、研究目标、研究问题与预期成果形式，是后续研究方法与进度安排的逻辑起点。

## 写作要求
1. 字数严格控制在 800-1200 字
2. 必须包含：
   - 研究目标（可分为总体目标与分目标）
   - 研究问题（2-4 个，表述清晰可检验）
   - 研究内容与任务分解（与研究问题一一对应）
   - 预期成果（论文结构、方法产出、应用/建议等）
3. 行文风格：学术、客观、严谨，避免空泛描述
4. 结构建议：先总体后分解，条理清晰
5. 输出格式：以 Markdown 二级标题开头：\`## 四、研究内容\`

## 禁止事项
- 不要跳到具体研究方法细节（研究方法章节再展开）
- 不要使用第一人称
- 不要使用指代不清的转述词

## 输出
直接输出章节内容（Markdown 格式），不要任何额外说明、不要使用代码块包裹。`;
}
