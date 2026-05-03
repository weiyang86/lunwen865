'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PromptVersion } from '@/types/prompt';

interface Props {
  version: PromptVersion;
  isCurrent: boolean;
  compareIndex: number | null;
  canCompareMore: boolean;
  commitMessageNode: ReactNode;
  metaText: string;
  onToggleCompare: () => void;
  onSetBaseline: () => void;
  onRollback: () => void;
}

export function PromptVersionListItem({
  version,
  isCurrent,
  compareIndex,
  canCompareMore,
  commitMessageNode,
  metaText,
  onToggleCompare,
  onSetBaseline,
  onRollback,
}: Props) {
  const compareSelected = compareIndex != null;
  const compareDisabled = !compareSelected && !canCompareMore;

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2',
        isCurrent ? 'border-primary bg-indigo-50/30' : '',
        !isCurrent && !compareSelected ? 'border-slate-200 bg-white hover:border-slate-300' : '',
        compareSelected ? 'border-amber-500 bg-amber-50/30' : '',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold">v{version.versionNo}</span>
        {isCurrent ? (
          <span className="rounded bg-primary px-1.5 py-0.5 text-xs text-white">当前</span>
        ) : null}
        {compareSelected ? (
          <span className="rounded bg-amber-500 px-1.5 py-0.5 text-xs text-white">
            对比 {compareIndex}
          </span>
        ) : null}
      </div>

      <div className="text-sm text-slate-800 break-words">{commitMessageNode}</div>

      <div className="flex items-center gap-2 text-xs text-slate-500">{metaText}</div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          variant="secondary"
          disabled={compareDisabled}
          className={cn(compareSelected ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' : '')}
          onClick={onToggleCompare}
        >
          对比
        </Button>

        {!isCurrent ? (
          <>
            <Button size="sm" variant="outline" onClick={onSetBaseline}>
              设为基线
            </Button>
            <Button size="sm" variant="outline" onClick={onRollback}>
              回滚
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

