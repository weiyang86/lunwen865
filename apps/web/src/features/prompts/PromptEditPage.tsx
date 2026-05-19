'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Tab } from '@headlessui/react';
import { Copy, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { promptApi } from '@/api/prompts';
import { DEFAULT_MODEL_CONFIG, type ModelConfig, type PromptDraft, type PromptVersion } from '@/types/prompt';
import { PromptEditorHeader } from './components/PromptEditorHeader';
import { PromptEditorPane } from './components/PromptEditorPane';
import { DiscardDraftDialog } from './components/DiscardDraftDialog';
import { PromptMetadataDialog } from './components/PromptMetadataDialog';
import { PromptModelPanel } from './components/PromptModelPanel';
import { SaveVersionDialog } from './components/SaveVersionDialog';
import { PromptVariablePanel } from './components/PromptVariablePanel';
import { PromptVersionDrawer } from './components/PromptVersionDrawer';
import { PromptTestPanel } from './components/test/PromptTestPanel';
import { usePromptEditor } from './hooks/usePromptEditor';
import { useExtractVariables } from './hooks/useExtractVariables';
import type { PromptVariable } from '@/types/prompt';

type PromptNodeExample = {
  id: string;
  label: string;
  sceneKey: string;
  description: string;
  content: string;
  variables: PromptVariable[];
  modelConfig: ModelConfig;
  metadata: { title: string; description: string; tags: string[] };
};

const NODE_EXAMPLES: PromptNodeExample[] = [
  {
    id: 'topic',
    label: '选题/题目生成',
    sceneKey: 'paper.topic.generate',
    description: '生成论文题目候选（JSON 输出）',
    content: `## 任务
基于用户主题、关键词与学术等级，生成 {{count}} 个论文题目候选。

## 输入
- 专业（major）：{{major}}
- 主题（topic）：{{topic}}
- 关键词（keywords）：{{keywordsText}}
- 学术等级（academicLevel）：{{academicLevel}}
- 语言（language）：{{language}}
- 偏好风格（preferredStyle）：{{preferredStyle}}
- 额外上下文（additionalContext）：{{additionalContext}}
- 用户反馈（feedback）：{{feedback}}
- 历史拒绝题目（rejectedTitles，必须避免相似）：
{{rejectedTitlesText}}

## 约束
1) 必须只输出 JSON，不要包含 markdown 代码块标记。
2) 题目深度需匹配学术等级；必须围绕主题与关键词展开；避免重复与过度相似。
3) 每个题目必须包含 rationale 与 estimatedDifficulty（EASY/MEDIUM/HARD）。

## 输出格式（JSON）
{
  "candidates": [
    {
      "title": "...",
      "rationale": "...",
      "keywords": ["...", "..."],
      "estimatedDifficulty": "MEDIUM"
    }
  ]
}`,
    variables: [
      { name: 'major', label: '专业', type: 'text', required: false, defaultValue: '工商管理', description: '' },
      { name: 'topic', label: '主题', type: 'textarea', required: true, defaultValue: '数字经济背景下中小企业融资约束', description: '' },
      { name: 'keywordsText', label: '关键词', type: 'text', required: false, defaultValue: '数字经济、中小企业、融资约束、供应链金融', description: '' },
      { name: 'academicLevel', label: '学术等级', type: 'select', required: true, defaultValue: 'UNDERGRADUATE', description: '', options: ['UNDERGRADUATE', 'MASTER', 'DOCTOR'] },
      { name: 'language', label: '语言', type: 'select', required: true, defaultValue: 'zh-CN', description: '', options: ['zh-CN', 'en-US'] },
      { name: 'count', label: '候选数量', type: 'number', required: true, defaultValue: '8', description: '' },
      { name: 'preferredStyle', label: '偏好风格', type: 'text', required: false, defaultValue: '应用导向，问题清晰，可落地', description: '' },
      { name: 'additionalContext', label: '额外上下文', type: 'textarea', required: false, defaultValue: '聚焦 2022-2026 年政策与案例', description: '' },
      { name: 'feedback', label: '用户反馈', type: 'textarea', required: false, defaultValue: '', description: '' },
      { name: 'rejectedTitlesText', label: '拒绝题目', type: 'textarea', required: false, defaultValue: '（无）', description: '' },
    ],
    modelConfig: { ...DEFAULT_MODEL_CONFIG },
    metadata: { title: '选题生成', description: '根据主题/关键词生成论文题目候选', tags: ['论文', '选题'] },
  },
  {
    id: 'opening',
    label: '开题报告生成',
    sceneKey: 'paper.opening.generate',
    description: '生成开题报告主要章节（结构化输出）',
    content: `你是严谨的论文写作助手。请根据输入信息生成一份开题报告正文，要求结构清晰、论证充分、语气学术化。

论文题目：{{title}}
研究方向/主题：{{topic}}
关键词：{{keywordsText}}
学术等级：{{academicLevelText}}
目标总字数：{{targetWordCount}}

额外要求：
{{additionalRequirements}}

输出要求：
1) 先输出目录（一级/二级标题）
2) 再按目录输出正文，各小节不少于 300 字
3) 不要输出除目录与正文之外的其他内容`,
    variables: [
      { name: 'title', label: '论文题目', type: 'text', required: true, defaultValue: '数字经济背景下中小企业融资问题研究', description: '' },
      { name: 'topic', label: '研究方向/主题', type: 'textarea', required: true, defaultValue: '从供应链金融视角分析融资约束与缓解路径', description: '' },
      { name: 'keywordsText', label: '关键词', type: 'text', required: false, defaultValue: '数字经济；中小企业；融资约束；供应链金融', description: '' },
      { name: 'academicLevelText', label: '学术等级', type: 'select', required: true, defaultValue: '本科毕业论文', description: '', options: ['本科毕业论文', '硕士学位论文', '博士学位论文'] },
      { name: 'targetWordCount', label: '目标总字数', type: 'number', required: true, defaultValue: '12000', description: '' },
      { name: 'additionalRequirements', label: '额外要求', type: 'textarea', required: false, defaultValue: '结合近 5 年政策与典型案例，给出可执行建议', description: '' },
    ],
    modelConfig: { ...DEFAULT_MODEL_CONFIG },
    metadata: { title: '开题报告生成', description: '生成开题报告目录与正文', tags: ['论文', '开题'] },
  },
  {
    id: 'outline',
    label: '目录/大纲生成',
    sceneKey: 'paper.outline.generate',
    description: '生成论文目录与各节摘要（结构化输出）',
    content: `你是论文大纲规划助手。请根据输入信息生成论文大纲（目录），并为每个章节/小节提供 1-3 句摘要与建议字数。

学术等级：{{academicLevelText}}
论文题目：{{title}}
研究主题：{{topic}}
关键词：{{keywordsText}}
目标字数：{{targetWordCount}}

开题报告（节选）：
{{openingReportContent}}

用户额外要求：
{{additionalRequirements}}

约束：
1) 章节数量建议：{{chapterCountRange}}
2) 大纲深度最多 {{maxDepth}} 层
3) 建议每节字数在 {{sectionMinWords}}-{{sectionMaxWords}} 之间
4) 输出必须只包含 JSON，不要 markdown 代码块

输出 JSON：
{
  "outline": [
    { "title": "第一章 ...", "summary": "...", "expectedWords": 1200, "children": [] }
  ]
}`,
    variables: [
      { name: 'academicLevelText', label: '学术等级', type: 'select', required: true, defaultValue: '本科毕业论文', description: '', options: ['本科毕业论文', '硕士学位论文', '博士学位论文'] },
      { name: 'title', label: '论文题目', type: 'text', required: true, defaultValue: '数字经济背景下中小企业融资问题研究', description: '' },
      { name: 'topic', label: '研究主题', type: 'textarea', required: true, defaultValue: '供应链金融视角的融资约束与缓解路径', description: '' },
      { name: 'keywordsText', label: '关键词', type: 'text', required: false, defaultValue: '数字经济、中小企业、融资约束、供应链金融', description: '' },
      { name: 'targetWordCount', label: '目标字数', type: 'number', required: true, defaultValue: '12000', description: '' },
      { name: 'openingReportContent', label: '开题报告', type: 'textarea', required: false, defaultValue: '（可粘贴开题报告主要内容）', description: '' },
      { name: 'additionalRequirements', label: '额外要求', type: 'textarea', required: false, defaultValue: '', description: '' },
      { name: 'chapterCountRange', label: '章节数建议', type: 'text', required: false, defaultValue: '5-7', description: '' },
      { name: 'maxDepth', label: '大纲深度', type: 'number', required: true, defaultValue: '3', description: '' },
      { name: 'sectionMinWords', label: '小节最少字数', type: 'number', required: true, defaultValue: '200', description: '' },
      { name: 'sectionMaxWords', label: '小节最多字数', type: 'number', required: true, defaultValue: '1800', description: '' },
    ],
    modelConfig: { ...DEFAULT_MODEL_CONFIG },
    metadata: { title: '目录/大纲生成', description: '生成大纲与每节摘要/建议字数', tags: ['论文', '大纲'] },
  },
  {
    id: 'abstract',
    label: '摘要生成（中英）',
    sceneKey: 'paper.abstract.generate',
    description: '根据题目/方向/大纲生成中英文摘要（JSON 输出）',
    content: `你是论文写作助手。请生成论文摘要，必须同时包含中文摘要与英文摘要。

论文题目：{{title}}
研究主题/题目方向：{{topic}}
目标字数：{{wordCountTarget}}

目录/大纲：
{{outlineText}}

已有摘要（用于改写/优化，可选）：
中文摘要：{{previousZh}}
英文摘要：{{previousEn}}

导师/用户建议（可选，必须优先采纳）：
{{feedback}}

输出要求：
1) 严格输出 JSON（不要 markdown 代码块），形如：{"abstractZh":"...","abstractEn":"..."}
2) 中文摘要约 300-500 字，英文摘要约 150-250 词
3) 内容包含：背景/目的、方法或思路、主要结论或贡献，语言学术化`,
    variables: [
      { name: 'title', label: '论文题目', type: 'text', required: true, defaultValue: '数字经济背景下中小企业融资问题研究', description: '' },
      { name: 'topic', label: '研究主题/方向', type: 'textarea', required: true, defaultValue: '供应链金融视角的融资约束与缓解路径', description: '' },
      { name: 'outlineText', label: '大纲文本', type: 'textarea', required: false, defaultValue: '（可粘贴目录/大纲）', description: '' },
      { name: 'wordCountTarget', label: '目标字数', type: 'number', required: false, defaultValue: '400', description: '' },
      { name: 'previousZh', label: '已有中文摘要', type: 'textarea', required: false, defaultValue: '', description: '' },
      { name: 'previousEn', label: '已有英文摘要', type: 'textarea', required: false, defaultValue: '', description: '' },
      { name: 'feedback', label: '导师/用户建议', type: 'textarea', required: false, defaultValue: '', description: '' },
    ],
    modelConfig: { ...DEFAULT_MODEL_CONFIG },
    metadata: { title: '摘要生成（中英）', description: '生成中英文摘要 JSON', tags: ['论文', '摘要'] },
  },
  {
    id: 'section',
    label: '章节/小节生成',
    sceneKey: 'paper.section.generate',
    description: '根据大纲生成某一节正文（连贯写作）',
    content: `你是严谨的论文写作助手。请根据输入信息撰写本节正文，确保逻辑严谨、层次清晰、避免口语化。

学术等级：{{educationLabel}}
论文题目：{{title}}
研究主题：{{topic}}
关键词：{{keywordsText}}
论文总字数：{{totalWordCount}}

全部章节标题：
{{allChapterTitlesText}}

当前章节：{{chapterTitle}}
当前小节：{{sectionTitle}}
本节摘要/写作提示：{{sectionSummary}}
建议字数：{{expectedWords}}

上一节末尾（保证连贯，仅参考，勿复述）：
{{previousSummary}}

输出要求：
1) 只输出正文内容，不要输出标题编号
2) 内容要有论证过程与必要过渡
3) 避免编造具体不可验证数据，可用“例如/一般认为”等表述替代`,
    variables: [
      { name: 'educationLabel', label: '学术等级', type: 'select', required: true, defaultValue: '本科毕业论文', description: '', options: ['本科毕业论文', '硕士学位论文', '博士学位论文'] },
      { name: 'title', label: '论文题目', type: 'text', required: true, defaultValue: '数字经济背景下中小企业融资问题研究', description: '' },
      { name: 'topic', label: '研究主题', type: 'textarea', required: true, defaultValue: '供应链金融视角的融资约束与缓解路径', description: '' },
      { name: 'keywordsText', label: '关键词', type: 'text', required: false, defaultValue: '数字经济、中小企业、融资约束、供应链金融', description: '' },
      { name: 'totalWordCount', label: '论文总字数', type: 'number', required: true, defaultValue: '12000', description: '' },
      { name: 'allChapterTitlesText', label: '全部章节标题', type: 'textarea', required: false, defaultValue: '1. 绪论\n2. 文献综述\n3. 研究设计\n4. 实证分析\n5. 结论与建议', description: '' },
      { name: 'chapterTitle', label: '当前章节', type: 'text', required: true, defaultValue: '第三章 研究设计', description: '' },
      { name: 'sectionTitle', label: '当前小节', type: 'text', required: true, defaultValue: '3.2 变量定义与数据来源', description: '' },
      { name: 'sectionSummary', label: '本节摘要/提示', type: 'textarea', required: false, defaultValue: '说明核心变量定义、度量方法与数据口径。', description: '' },
      { name: 'expectedWords', label: '建议字数', type: 'number', required: true, defaultValue: '900', description: '' },
      { name: 'previousSummary', label: '上一节末尾', type: 'textarea', required: false, defaultValue: '', description: '' },
    ],
    modelConfig: { ...DEFAULT_MODEL_CONFIG },
    metadata: { title: '章节/小节生成', description: '生成某一节论文正文', tags: ['论文', '正文'] },
  },
  {
    id: 'reference',
    label: '参考文献生成',
    sceneKey: 'paper.reference.generate',
    description: '生成参考文献条目（JSON 输出）',
    content: `你是严谨的学术研究助理。请为以下论文生成符合学术常识的参考文献条目。注意：本阶段全部标记 verified=false，后续由用户核实。

题目：{{title}}

大纲（章/节标题）：
{{outlineTitlesText}}

正文片段（节选）：
{{contentSnippetsText}}

生成要求：
- 数量：{{count}} 条
- 时间范围：近 {{recentYears}} 年为主，必要时可包含经典文献
- 侧重点/要求：{{focus}}
- 语言比例：中文约 {{zhRatio}}%，英文约 {{enRatio}}%
- 类型分布（尽量满足）：{{typeDistributionText}}

输出必须是 JSON，且仅输出 JSON，不要包含解释文字

输出 JSON：
{
  "references": [
    {
      "type": "JOURNAL",
      "title": "...",
      "authors": "...",
      "year": 2023,
      "journal": "...",
      "doi": "10.xxxx/xxxx"
    }
  ]
}`,
    variables: [
      { name: 'title', label: '论文题目', type: 'text', required: true, defaultValue: '数字经济背景下中小企业融资问题研究', description: '' },
      { name: 'outlineTitlesText', label: '大纲标题', type: 'textarea', required: false, defaultValue: '1. 绪论\n2. 文献综述\n3. 研究设计\n4. 实证分析\n5. 结论与建议', description: '' },
      { name: 'contentSnippetsText', label: '正文片段', type: 'textarea', required: false, defaultValue: '片段1：...\n\n片段2：...', description: '' },
      { name: 'count', label: '数量', type: 'number', required: true, defaultValue: '20', description: '' },
      { name: 'recentYears', label: '近几年', type: 'number', required: true, defaultValue: '5', description: '' },
      { name: 'focus', label: '侧重点', type: 'textarea', required: false, defaultValue: '融资约束、供应链金融、数字化转型', description: '' },
      { name: 'zhRatio', label: '中文比例(%)', type: 'number', required: true, defaultValue: '50', description: '' },
      { name: 'enRatio', label: '英文比例(%)', type: 'number', required: true, defaultValue: '50', description: '' },
      { name: 'typeDistributionText', label: '类型分布', type: 'text', required: false, defaultValue: 'JOURNAL:60%, THESIS:15%, CONFERENCE:15%, BOOK:10%', description: '' },
    ],
    modelConfig: { ...DEFAULT_MODEL_CONFIG },
    metadata: { title: '参考文献生成', description: '生成参考文献 JSON', tags: ['论文', '参考文献'] },
  },
];

export function PromptEditPage({ id }: { id: string }) {
  const router = useRouter();

  const editor = usePromptEditor(id);
  const extract = useExtractVariables(editor.content, editor.variables);

  const [metadataOpen, setMetadataOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<PromptVersion | null>(null);
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [exampleId, setExampleId] = useState<string>('section');

  const [testDraftSnapshot, setTestDraftSnapshot] = useState<PromptDraft>(() => ({
    templateId: id,
    content: editor.content,
    variables: editor.variables,
    modelConfig: editor.modelConfig,
    metadata: editor.metadata,
    updatedAt: editor.detail?.draft?.updatedAt ?? new Date().toISOString(),
  }));

  useEffect(() => {
    const t = window.setTimeout(() => {
      setTestDraftSnapshot({
        templateId: id,
        content: editor.content,
        variables: editor.variables,
        modelConfig: editor.modelConfig,
        metadata: editor.metadata,
        updatedAt: editor.detail?.draft?.updatedAt ?? new Date().toISOString(),
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [
    editor.content,
    editor.detail?.draft?.updatedAt,
    editor.metadata,
    editor.modelConfig,
    editor.variables,
    id,
  ]);

  const draftForDialog: PromptDraft = useMemo(
    () => ({
      templateId: id,
      content: editor.content,
      variables: editor.variables,
      modelConfig: editor.modelConfig,
      metadata: editor.metadata,
      updatedAt: editor.detail?.draft?.updatedAt ?? new Date().toISOString(),
    }),
    [editor.content, editor.detail?.draft?.updatedAt, editor.metadata, editor.modelConfig, editor.variables, id],
  );

  const baseForDialog: PromptVersion = useMemo(() => {
    if (editor.baseVersion) return editor.baseVersion;
    return {
      id: '',
      templateId: id,
      versionNo: 0,
      content: '',
      variables: [],
      modelConfig: DEFAULT_MODEL_CONFIG,
      metadata: {
        title: editor.detail?.name ?? '',
        description: editor.detail?.description ?? '',
        tags: editor.detail?.tags ?? [],
      },
      changelog: '',
      createdAt: '',
      createdBy: null,
    };
  }, [editor.baseVersion, editor.detail?.description, editor.detail?.name, editor.detail?.tags, id]);

  const currentExample = useMemo(() => {
    return NODE_EXAMPLES.find((x) => x.id === exampleId) ?? NODE_EXAMPLES[0];
  }, [exampleId]);

  function copyText(text: string, okMsg: string) {
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success(okMsg))
      .catch(() => toast.error('复制失败，请手动复制'));
  }

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (editor.saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editor.saveStatus]);

  if (editor.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-96 w-full lg:col-span-7" />
          <Skeleton className="h-48 w-full lg:col-span-5" />
        </div>
      </div>
    );
  }

  if (editor.error || !editor.detail) {
    const errorMsg = editor.error?.message?.trim();
    const isNotFound =
      errorMsg === '模板不存在' ||
      errorMsg === 'Not Found' ||
      errorMsg?.includes('模板不存在') ||
      errorMsg?.includes('404');
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-10 text-center">
        <div className="text-sm text-rose-700">
          {isNotFound ? '模板不存在或已被删除' : '加载失败'}
        </div>
        {errorMsg && !isNotFound ? (
          <div className="mt-2 text-xs text-rose-700/80">{errorMsg}</div>
        ) : null}
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/prompts')}>
            返回列表
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/prompts?create=1&example=1')}>
            新建模板（示例）
          </Button>
          <Button variant="outline" onClick={editor.refresh}>
            重试
          </Button>
        </div>
      </div>
    );
  }

  function tabCls(selected: boolean) {
    return [
      'whitespace-nowrap px-4 py-2 text-sm -mb-px border-b-2 focus:outline-none',
      selected
        ? 'font-medium text-primary border-primary'
        : 'text-slate-500 hover:text-slate-700 border-transparent',
    ].join(' ');
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PromptEditorHeader
        detail={editor.detail}
        saveStatus={editor.saveStatus}
        lastSavedAt={editor.lastSavedAt}
        onSaveRetry={() => void editor.saveNow()}
        onBack={async () => {
          if (editor.saveStatus === 'saving') await editor.saveNow();
          router.push('/admin/prompts');
        }}
        onOpenVersions={() => setVersionDrawerOpen(true)}
        onOpenMeta={() => setMetadataOpen(true)}
        onOpenDiscard={() => setDiscardOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onSaveVersion={() => {
          setRollbackTarget(null);
          setSaveOpen(true);
        }}
        togglingEnabled={togglingEnabled}
        onToggleEnabled={async () => {
          if (togglingEnabled) return;
          const enabled = editor.detail?.status === 'ENABLED';
          const ok = window.confirm(enabled ? '确认禁用该模板吗？禁用后线上不会再使用该模板。' : '确认启用该模板吗？启用后线上会使用该模板。');
          if (!ok) return;
          try {
            setTogglingEnabled(true);
            await editor.setEnabled(!enabled);
            toast.success(!enabled ? '已启用' : '已禁用');
          } catch (e: unknown) {
            toast.error((e as any)?.message || '操作失败，请稍后重试');
          } finally {
            setTogglingEnabled(false);
          }
        }}
        testOpen={testPanelOpen}
        testRunning={testRunning}
        onToggleTest={() => setTestPanelOpen((v) => !v)}
      />

      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        <div className="flex-1">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">论文生成节点样例模板</div>
                      <div className="mt-1 text-xs text-slate-500">
                        用于快速参考/复制/填入当前编辑器，不会自动改 sceneKey
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="sm">
                            {currentExample.label}
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {NODE_EXAMPLES.map((it) => (
                            <DropdownMenuItem key={it.id} onSelect={() => setExampleId(it.id)}>
                              {it.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const hasContent = Boolean(editor.content.trim());
                          const hasVars = editor.variables.length > 0;
                          const ok = !hasContent && !hasVars ? true : window.confirm('将覆盖当前提示词内容/变量/模型配置/元信息，是否继续？');
                          if (!ok) return;
                          editor.setContent(currentExample.content);
                          editor.setVariables(currentExample.variables);
                          editor.setModelConfig(currentExample.modelConfig);
                          editor.updateMetadata(currentExample.metadata);
                          toast.success('已填入样例模板（可继续修改）');
                        }}
                      >
                        一键填入编辑器
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-medium text-slate-700">推荐 sceneKey</div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => copyText(currentExample.sceneKey, '已复制 sceneKey')}
                          title="复制"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-2 break-all font-mono text-xs text-slate-800">
                        {currentExample.sceneKey}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">{currentExample.description}</div>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-medium text-slate-700">变量配置示例（JSON）</div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            copyText(
                              JSON.stringify(currentExample.variables, null, 2),
                              '已复制变量 JSON',
                            )
                          }
                          title="复制"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-800">
                        {JSON.stringify(currentExample.variables, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium text-slate-700">Prompt 内容示例</div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => copyText(currentExample.content, '已复制 Prompt 内容')}
                        title="复制"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-800">
                      {currentExample.content}
                    </pre>
                  </div>
                </div>

                <PromptEditorPane
                  content={editor.content}
                  onChange={editor.setContent}
                  variables={editor.variables}
                  onCreateVariable={(name) => {
                    if (editor.variables.some((v) => v.name === name)) return;
                    const next: PromptVariable = {
                      name,
                      label: name,
                      type: 'text',
                      required: true,
                      defaultValue: '',
                      description: '',
                    };
                    editor.setVariables([...editor.variables, next]);
                  }}
                />
              </div>
            </div>
            <div className="lg:col-span-5">
              <Tab.Group>
                <Tab.List className="mb-4 flex overflow-x-auto whitespace-nowrap border-b border-slate-200">
                  <Tab as={Fragment}>
                    {({ selected }: { selected: boolean }) => (
                      <button className={tabCls(selected)} type="button">
                        变量配置 ({editor.variables.length})
                        {extract.hasDiff ? (
                          <span className="ml-1 inline-block h-2 w-2 rounded-full bg-amber-500" />
                        ) : null}
                      </button>
                    )}
                  </Tab>
                  <Tab as={Fragment}>
                    {({ selected }: { selected: boolean }) => (
                      <button className={tabCls(selected)} type="button">
                        模型配置
                      </button>
                    )}
                  </Tab>
                </Tab.List>

                <Tab.Panels>
                  <Tab.Panel>
                    <PromptVariablePanel
                      variables={editor.variables}
                      onChange={editor.setVariables}
                      onUpdate={editor.updateVariable}
                      diff={extract.diff}
                      hasDiff={extract.hasDiff}
                      onSync={() => editor.setVariables(extract.syncToVariables())}
                    />
                  </Tab.Panel>
                  <Tab.Panel>
                    <PromptModelPanel value={editor.modelConfig} onChange={editor.setModelConfig} />
                  </Tab.Panel>
                </Tab.Panels>
              </Tab.Group>
            </div>
          </div>
        </div>
      </div>

      <PromptMetadataDialog
        open={metadataOpen}
        initial={{
          title: editor.metadata.title,
          description: editor.metadata.description,
          tags: editor.metadata.tags,
        }}
        onClose={() => setMetadataOpen(false)}
        onSave={(next) => editor.updateMetadata(next)}
      />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="mx-4 sm:mx-0 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>页面按钮说明</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-slate-700">
            <div className="space-y-2">
              <div className="font-medium text-slate-900">顶部按钮</div>
              <div>返回：回到 Prompt 模板列表；若正在保存草稿会先尝试保存一次。</div>
              <div>启用模板 / 禁用模板：控制业务侧是否可使用该模板。</div>
              <div>版本历史：查看已发布版本列表、对比差异、将某版本设为基线或回滚准备。</div>
              <div>测试：在弹框中进行试跑，用当前草稿或基线运行并查看输出。</div>
              <div>元信息：编辑标题/描述/tags，用于列表展示与检索。</div>
              <div>丢弃草稿：清空未发布草稿，回到当前已发布版本（或空白基线）。</div>
              <div>保存为新版本：将当前草稿发布为新版本，供线上调用使用。</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-slate-900">提示词内容区</div>
              <div>
                插入变量：将已有变量以 <span className="font-mono">{'{{name}}'}</span> 形式插入到光标处，也可新建变量。
              </div>
              <div>字符/变量统计：提示超长风险与当前识别到的变量数量。</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-slate-900">右侧面板</div>
              <div>变量配置：维护变量类型/是否必填/默认值；与内容变量不一致会出现提示点，可一键同步。</div>
              <div>模型配置：设置模型、温度、最大输出等参数。</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-slate-900">测试面板</div>
              <div>运行：用填写的变量值渲染并调用模型生成；中止：停止本次运行；清空：清空输出与运行记录展示。</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHelpOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testPanelOpen} onOpenChange={setTestPanelOpen}>
        <DialogContent
          className="mx-4 flex max-h-[85vh] flex-col overflow-hidden sm:mx-0 sm:max-w-4xl"
          onPointerDownOutside={(e) => {
            if (testRunning) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (testRunning) e.preventDefault();
          }}
        >
          <div className="min-h-0 flex-1 overflow-hidden">
            <PromptTestPanel
              open={testPanelOpen}
              onClose={() => setTestPanelOpen(false)}
              promptId={id}
              baseVersionNo={editor.baseVersion?.versionNo ?? null}
              isDirty={editor.isDirty}
              draftSnapshot={testDraftSnapshot}
              onRunningChange={setTestRunning}
              layout="dialog"
            />
          </div>
        </DialogContent>
      </Dialog>

      <DiscardDraftDialog
        open={discardOpen}
        hasDraft={editor.hasDraft}
        submitting={discarding}
        onClose={() => setDiscardOpen(false)}
        onConfirm={async () => {
          if (discarding) return;
          setDiscarding(true);
          try {
            await editor.discardDraft();
            toast.success('草稿已丢弃');
            setDiscardOpen(false);
          } finally {
            setDiscarding(false);
          }
        }}
      />

      <SaveVersionDialog
        open={saveOpen}
        draft={draftForDialog}
        baseVersion={baseForDialog}
        prefillFromVersion={rollbackTarget ?? undefined}
        onClose={() => {
          setSaveOpen(false);
          setRollbackTarget(null);
        }}
        onSubmit={async (commitMessage) => {
          if (editor.saveStatus === 'saving') await editor.saveNow();
          const src = rollbackTarget
            ? {
                content: rollbackTarget.content,
                variables: rollbackTarget.variables,
                modelConfig: rollbackTarget.modelConfig,
                metadata: rollbackTarget.metadata,
              }
            : {
                content: editor.content,
                variables: editor.variables,
                modelConfig: editor.modelConfig,
                metadata: editor.metadata,
              };
          const v = await promptApi.createVersion(id, { ...src, commitMessage });
          editor.applyNewVersion(v);
          setVersionDrawerOpen(false);
        }}
      />

      <PromptVersionDrawer
        open={versionDrawerOpen}
        promptId={id}
        baseVersion={editor.baseVersion}
        hasDraft={editor.hasDraft}
        onClose={() => setVersionDrawerOpen(false)}
        onSetBaseline={async (v) => {
          await promptApi.discardDraft(id).catch(() => null);
          editor.applyNewVersion(v);
          toast.success(`已切换到 v${v.versionNo} 为基线`);
          setVersionDrawerOpen(false);
        }}
        onRequestRollback={(v) => {
          setRollbackTarget(v);
          setSaveOpen(true);
        }}
      />
    </div>
  );
}
