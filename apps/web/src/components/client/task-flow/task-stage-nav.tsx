import Link from 'next/link';

type TaskStageNavProps = {
  taskId: string;
  activeStage: 'generate' | 'compose-format' | 'word-editor' | 'delivery';
};

const TASK_STAGE_NAV_ITEMS = [
  {
    key: 'generate',
    label: '论文内容生成',
    description: '题目、开题、大纲、摘要、正文素材生成',
    href: (taskId: string) => `/student/tasks/${encodeURIComponent(taskId)}/generate`,
  },
  {
    key: 'compose-format',
    label: '合稿与格式',
    description: '合并阶段素材、编辑论文文档与格式准备',
    href: (taskId: string) => `/student/tasks/${encodeURIComponent(taskId)}/compose-format`,
  },
  {
    key: 'word-editor',
    label: '在线 Word 精修',
    description: 'DOCX 后的人工排版与版式检查',
    href: (taskId: string) => `/student/tasks/${encodeURIComponent(taskId)}/word-editor`,
  },
  {
    key: 'delivery',
    label: '最终交付',
    description: '下载最终版本与查看交付文件',
    href: (taskId: string) => `/student/tasks/${encodeURIComponent(taskId)}/delivery`,
  },
] as const;

export function TaskStageNav({ taskId, activeStage }: TaskStageNavProps) {
  return (
    <nav className="rounded-xl border border-slate-200 bg-white p-3" aria-label="论文任务四阶段导航">
      <div className="grid gap-2 md:grid-cols-4">
        {TASK_STAGE_NAV_ITEMS.map((item, index) => {
          const active = item.key === activeStage;
          return (
            <Link
              key={item.key}
              href={item.href(taskId)}
              className={`rounded-lg border p-3 transition ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${active ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-700'}`}>
                  {index + 1}
                </span>
                <span className="text-sm font-semibold">{item.label}</span>
              </div>
              <p className={`mt-2 text-xs ${active ? 'text-slate-100' : 'text-slate-500'}`}>{item.description}</p>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
