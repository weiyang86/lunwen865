'use client';

import { Badge } from '@/components/ui/badge';
import type { StageType } from '@/types/order';
import { FileText, PenLine, ScrollText, Sparkles } from 'lucide-react';

const META: Record<StageType, { label: string; Icon: typeof Sparkles }> = {
  TOPIC: { label: '题目', Icon: Sparkles },
  OPENING: { label: '开题', Icon: ScrollText },
  OUTLINE: { label: '大纲', Icon: FileText },
  WRITING: { label: '写作', Icon: PenLine },
  MERGING: { label: '合稿', Icon: FileText },
  FORMATTING: { label: '排版', Icon: FileText },
  REVIEW: { label: '审核', Icon: ScrollText },
  REVISION: { label: '修改', Icon: PenLine },
};

export function StageBadge({ stage }: { stage: StageType | null }) {
  if (!stage) return <span className="text-slate-400">—</span>;
  const meta = META[stage];
  const Icon = meta.Icon;
  return (
    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
      <Icon className="mr-1 h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  );
}

