import { PrismaClient, PromptStatus } from '@prisma/client';

const prisma = new PrismaClient();

type SeedPrompt = {
  code: string;
  name: string;
  scene:
    | 'PAPER_OUTLINE'
    | 'PAPER_SECTION'
    | 'PAPER_ABSTRACT'
    | 'POLISH_ACADEMIC'
    | 'POLISH_FLUENT'
    | 'POLISH_TRANSLATE'
    | 'OTHER';
  description?: string;
  content: string;
  variables: Array<{
    name: string;
    label?: string;
    required?: boolean;
    defaultValue?: string;
    description?: string;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  status?: PromptStatus;
};

const DEFAULT_PROMPTS: SeedPrompt[] = [
  {
    code: 'paper.outline',
    name: '论文大纲生成（JSON）',
    scene: 'PAPER_OUTLINE',
    content: `你是一位资深的学术写作专家，正在为一篇{{academicLevelText}}设计详细论文大纲。

## 论文信息
- 题目：{{title}}
- 主题领域：{{topic}}
- 关键词：{{keywordsText}}
- 目标总字数：{{targetWordCount}} 字

## 已有的开题报告内容（精简上下文）
{{openingReportTruncated}}

{{additionalRequirementsBlock}}## 大纲设计要求

### 章节结构
- 设计 {{chapterCountRange}} 个章节（CHAPTER）
- 每章下设 2-6 个节（SECTION）
- 默认只生成到 SECTION 为叶子节点；不得超过 {{maxDepth}} 层嵌套

参考结构（仅供参考，内容请按题目调整）：
1. 绪论（研究背景、研究意义、研究内容、论文结构）
2. 相关理论与技术综述
3. 核心方法/模型设计
4. 实验/验证/案例分析
5. 总结与展望

### 字数分配
- 所有叶子节点（即所有 SECTION）的 expectedWords 之和必须接近 {{targetWordCount}}（误差 ±10% 内）
- 单个 SECTION 字数：{{sectionMinWords}} 到 {{sectionMaxWords}} 字
- 绪论与总结章节字数应少于核心章节

### 标题风格
- 章标题：精炼、突出主题，4-12 字
- 节标题：具体、可执行，4-15 字
- 标题中不要包含“第几章”“1.1”等序号（系统会自动编号）
- 不要使用“探索”“浅析”“刍议”等空泛动词

### 摘要 summary
- 每个章节与每个节都必须有 summary，描述本章/本节将写什么
- 章 summary：50-200 字
- 节 summary：30-150 字
- summary 用陈述句，避免“将探讨”“主要研究”等套话

## 输出格式
严格按以下 JSON 结构输出（不要任何额外说明；不要使用 markdown 代码块；不要输出多余字段）：
{
  "chapters": [
    {
      "title": "绪论",
      "summary": "……",
      "children": [
        {
          "title": "研究背景",
          "summary": "……",
          "expectedWords": 800
        }
      ]
    }
  ]
}

## 禁止事项
- 不要输出超过 {{maxDepth}} 层嵌套
- 不要输出 expectedWords 为 0
- 不要让 children 数组为空
- 不要输出 markdown，只输出 JSON`,
    variables: [
      { name: 'academicLevelText', required: true },
      { name: 'title', required: true },
      { name: 'topic', required: true },
      { name: 'keywordsText', required: true, defaultValue: '（无）' },
      { name: 'targetWordCount', required: true },
      { name: 'openingReportTruncated', required: true, defaultValue: '' },
      { name: 'additionalRequirementsBlock', required: false, defaultValue: '' },
      { name: 'chapterCountRange', required: true, defaultValue: '5-7' },
      { name: 'maxDepth', required: true, defaultValue: '2' },
      { name: 'sectionMinWords', required: true, defaultValue: '300' },
      { name: 'sectionMaxWords', required: true, defaultValue: '1200' },
    ],
    status: PromptStatus.ACTIVE,
  },
  {
    code: 'paper.outline.section_regen',
    name: '大纲局部重生成（JSON）',
    scene: 'OTHER',
    content: `你是一位资深的学术写作专家，正在为一篇{{academicLevelText}}的大纲做“局部重生成”，要求与整体结构保持一致。

## 论文信息
- 题目：{{paperTitle}}
- 主题领域：{{topic}}
- 关键词：{{keywordsText}}
- 目标总字数：{{targetWordCount}} 字
- 大纲最大深度：{{outlineMaxDepth}}

## 当前需要重生成的节点
- 标题：{{currentNodeTitle}}
- 深度：{{currentNodeDepth}}
- 现有摘要：{{currentNodeSummaryText}}

## 同级节点摘要（用于保持一致性）
{{siblingsText}}

## 当前大纲骨架（仅用于对齐结构与术语）
{{outlineSkeletonTruncated}}

{{feedbackBlock}}{{additionalRequirementsBlock}}## 输出要求
- 只输出一个 JSON 对象，表示“当前节点”的最新内容（包含 children 子节点）
- 不要输出任何额外说明，不要使用 markdown 代码块
- title/summary 要与整体骨架一致，避免引入全新、无关的章节方向
- children 不能为空；如果当前节点应为叶子节点，则不要输出 children 字段，并必须输出 expectedWords

## 输出格式（示例）
{
  "title": "当前节点标题",
  "summary": "当前节点摘要",
  "children": [
    {
      "title": "子节点标题",
      "summary": "子节点摘要",
      "expectedWords": 800
    }
  ]
}`,
    variables: [
      { name: 'academicLevelText', required: true },
      { name: 'paperTitle', required: true },
      { name: 'topic', required: true },
      { name: 'keywordsText', required: true, defaultValue: '（无）' },
      { name: 'targetWordCount', required: true },
      { name: 'outlineMaxDepth', required: true, defaultValue: '2' },
      { name: 'currentNodeTitle', required: true },
      { name: 'currentNodeDepth', required: true },
      { name: 'currentNodeSummaryText', required: false, defaultValue: '（无）' },
      { name: 'siblingsText', required: false, defaultValue: '- （无）' },
      { name: 'outlineSkeletonTruncated', required: false, defaultValue: '' },
      { name: 'feedbackBlock', required: false, defaultValue: '' },
      { name: 'additionalRequirementsBlock', required: false, defaultValue: '' },
    ],
    status: PromptStatus.ACTIVE,
  },
  {
    code: 'paper.section',
    name: '正文小节生成',
    scene: 'PAPER_SECTION',
    content: `你是资深学术写作专家，正在撰写一篇{{educationLabel}}。请严格按要求生成正文段落。

## 论文基本信息
- 题目：{{title}}
- 主题领域：{{topic}}
- 关键词：{{keywordsText}}
- 目标总字数：{{totalWordCount}} 字

## 完整大纲（仅章标题）
{{allChapterTitlesText}}

## 当前任务
你现在要写的是：**{{chapterTitle}} {{sectionTitle}}**

### 本节摘要
{{sectionSummary}}

### 本节预期字数
{{expectedWords}} 字（允许 ±20%）

{{previousSummaryBlock}}## 写作要求
1. 紧扣摘要不偏题；有学术深度（观点+论据+推理）
2. 严禁套话（"随着 XX 的发展""综上所述"等）
3. 段落 150-300 字，信息密度高

## 引用规范（强制）
引用他人观点/数据/方法时立即标注：[REF:KEY]
KEY 命名：全大写+数字+下划线，推荐"作者_年份_主题"
- [REF:LECUN_2015_DL]
- [REF:VASWANI_2017_ATTN]
同一文献 KEY 全文一致。基于领域常识合理使用，文献信息后续阶段补全。

## 格式
- 直接输出正文，不输出标题
- 不用 markdown（无 # ** - 等）
- 段落间单换行
- 不要"综上""本节小结"
- 严禁占位符如"（此处省略）"

## 现在开始撰写本节正文：`,
    variables: [
      { name: 'educationLabel', required: true },
      { name: 'title', required: true },
      { name: 'topic', required: true },
      { name: 'keywordsText', required: true, defaultValue: '' },
      { name: 'totalWordCount', required: true },
      { name: 'allChapterTitlesText', required: true, defaultValue: '' },
      { name: 'chapterTitle', required: true },
      { name: 'sectionTitle', required: true },
      { name: 'sectionSummary', required: false, defaultValue: '' },
      { name: 'expectedWords', required: true, defaultValue: '1500' },
      { name: 'previousSummaryBlock', required: false, defaultValue: '' },
    ],
    status: PromptStatus.ACTIVE,
  },
  {
    code: 'paper.section.retry',
    name: '正文小节重试生成',
    scene: 'PAPER_SECTION',
    content: `你是资深学术写作专家，正在撰写一篇{{educationLabel}}。请严格按要求生成正文段落。

## 论文基本信息
- 题目：{{title}}
- 主题领域：{{topic}}
- 关键词：{{keywordsText}}
- 目标总字数：{{totalWordCount}} 字

## 完整大纲（仅章标题）
{{allChapterTitlesText}}

## 当前任务
你现在要写的是：**{{chapterTitle}} {{sectionTitle}}**

### 本节摘要
{{sectionSummary}}

### 本节预期字数
{{expectedWords}} 字（允许 ±20%）

{{previousSummaryBlock}}## ⚠️ 用户对上次输出的反馈（仅参考，不要把反馈写进正文）
"{{feedback}}"

请根据反馈重新撰写本节，避免重复同样问题。

## 写作要求
1. 紧扣摘要不偏题；有学术深度（观点+论据+推理）
2. 严禁套话（"随着 XX 的发展""综上所述"等）
3. 段落 150-300 字，信息密度高

## 引用规范（强制）
引用他人观点/数据/方法时立即标注：[REF:KEY]
KEY 命名：全大写+数字+下划线，推荐"作者_年份_主题"
- [REF:LECUN_2015_DL]
- [REF:VASWANI_2017_ATTN]
同一文献 KEY 全文一致。基于领域常识合理使用，文献信息后续阶段补全。

## 格式
- 直接输出正文，不输出标题
- 不用 markdown（无 # ** - 等）
- 段落间单换行
- 不要"综上""本节小结"
- 严禁占位符如"（此处省略）"

## 现在开始撰写本节正文：`,
    variables: [
      { name: 'feedback', required: true, defaultValue: '' },
      { name: 'educationLabel', required: true },
      { name: 'title', required: true },
      { name: 'topic', required: true },
      { name: 'keywordsText', required: true, defaultValue: '' },
      { name: 'totalWordCount', required: true },
      { name: 'allChapterTitlesText', required: true, defaultValue: '' },
      { name: 'chapterTitle', required: true },
      { name: 'sectionTitle', required: true },
      { name: 'sectionSummary', required: false, defaultValue: '' },
      { name: 'expectedWords', required: true, defaultValue: '1500' },
      { name: 'previousSummaryBlock', required: false, defaultValue: '' },
    ],
    status: PromptStatus.ACTIVE,
  },
  {
    code: 'paper.abstract',
    name: '摘要生成',
    scene: 'PAPER_ABSTRACT',
    content: `请为论文生成中文摘要：

论文标题：{{title}}
主题领域：{{topic}}
关键词：{{keywordsText}}
正文内容：{{content}}

要求：120-300 字，学术化表达，不要列点。`,
    variables: [
      { name: 'title', required: true },
      { name: 'topic', required: true, defaultValue: '' },
      { name: 'keywordsText', required: false, defaultValue: '' },
      { name: 'content', required: true },
    ],
    status: PromptStatus.ACTIVE,
  },
  {
    code: 'polish.academic',
    name: '学术润色',
    scene: 'POLISH_ACADEMIC',
    content: `请对以下文本进行学术化润色，保持原意但提升表达：

{{text}}`,
    variables: [{ name: 'text', required: true }],
    status: PromptStatus.ACTIVE,
  },
  {
    code: 'polish.fluent',
    name: '流畅润色',
    scene: 'POLISH_FLUENT',
    content: `请对以下文本进行流畅性润色，保持原意不变：

{{text}}`,
    variables: [{ name: 'text', required: true }],
    status: PromptStatus.ACTIVE,
  },
  {
    code: 'polish.translate',
    name: '中英互译（按需）',
    scene: 'POLISH_TRANSLATE',
    content: `请将以下文本翻译为目标语言（如果原文为中文则译为英文，如果原文为英文则译为中文），保持学术表达：

{{text}}`,
    variables: [{ name: 'text', required: true }],
    status: PromptStatus.ACTIVE,
  },
];

async function main() {
  for (const p of DEFAULT_PROMPTS) {
    const exists = await prisma.promptTemplate.findUnique({
      where: { code: p.code },
      select: { id: true },
    });
    if (exists) {
      console.log(`- skip ${p.code} (已存在)`);
      continue;
    }

    const tpl = await prisma.promptTemplate.create({
      data: {
        code: p.code,
        name: p.name,
        scene: p.scene as any,
        description: p.description ?? null,
        content: p.content,
        variables: p.variables as any,
        model: p.model ?? null,
        temperature: p.temperature ?? null,
        maxTokens: p.maxTokens ?? null,
        status: p.status ?? PromptStatus.ACTIVE,
        currentVersion: 1,
        createdBy: 'system',
        updatedBy: 'system',
      },
    });

    await prisma.promptVersion.create({
      data: {
        templateId: tpl.id,
        version: 1,
        content: tpl.content,
        variables: tpl.variables as any,
        model: tpl.model,
        temperature: tpl.temperature,
        maxTokens: tpl.maxTokens,
        changelog: 'seed',
        operatorId: 'system',
      },
    });

    console.log(`✓ created ${p.code}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
