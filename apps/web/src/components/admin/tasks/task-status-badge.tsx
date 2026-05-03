'use client';

import { cn } from '@/lib/utils';
import type { BackendTaskStatus } from '@/services/admin/tasks';

const META: Record<BackendTaskStatus, { label: string; cls: string }> = {
  INIT: { label: '待开始', cls: 'bg-slate-100 text-slate-700' },

  TOPIC_GENERATING: { label: '题目生成中', cls: 'bg-blue-100 text-blue-800' },
  TOPIC_PENDING_REVIEW: { label: '题目待审核', cls: 'bg-amber-100 text-amber-800' },
  TOPIC_APPROVED: { label: '题目已通过', cls: 'bg-emerald-100 text-emerald-800' },

  OPENING_GENERATING: { label: '开题生成中', cls: 'bg-blue-100 text-blue-800' },
  OPENING_PENDING_REVIEW: { label: '开题待审核', cls: 'bg-amber-100 text-amber-800' },
  OPENING_APPROVED: { label: '开题已通过', cls: 'bg-emerald-100 text-emerald-800' },

  OUTLINE_GENERATING: { label: '大纲生成中', cls: 'bg-blue-100 text-blue-800' },
  OUTLINE_PENDING_REVIEW: { label: '大纲待审核', cls: 'bg-amber-100 text-amber-800' },
  OUTLINE_APPROVED: { label: '大纲已通过', cls: 'bg-emerald-100 text-emerald-800' },

  WRITING: { label: '写作中', cls: 'bg-indigo-100 text-indigo-800' },
  WRITING_PAUSED: { label: '写作暂停', cls: 'bg-slate-100 text-slate-700' },
  MERGING: { label: '合稿中', cls: 'bg-indigo-100 text-indigo-800' },
  FORMATTING: { label: '排版中', cls: 'bg-indigo-100 text-indigo-800' },
  REVIEW: { label: '审核中', cls: 'bg-amber-100 text-amber-800' },
  REVISION: { label: '修改中', cls: 'bg-orange-100 text-orange-800' },

  DONE: { label: '已完成', cls: 'bg-emerald-100 text-emerald-800' },
  FAILED: { label: '失败', cls: 'bg-rose-100 text-rose-800' },
  CANCELLED: { label: '已取消', cls: 'bg-slate-100 text-slate-600' },
};

export function TaskStatusBadge({ status }: { status: BackendTaskStatus }) {
  const m = META[status];
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}
