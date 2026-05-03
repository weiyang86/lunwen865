'use client';

import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  History,
  Loader2,
  Rocket,
  Settings,
  TestTube2,
  Undo2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PromptTemplateDetail } from '@/types/prompt';
import { cn } from '@/lib/utils';

interface Props {
  detail: PromptTemplateDetail;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: Date | null;
  onSaveRetry: () => void;
  onBack: () => void | Promise<void>;
  onOpenVersions: () => void;
  onOpenMeta: () => void;
  onOpenDiscard: () => void;
  onSaveVersion: () => void;
  testOpen: boolean;
  testRunning: boolean;
  onToggleTest: () => void;
}

function SaveStatusIndicator({
  saveStatus,
  lastSavedAt,
  onSaveRetry,
}: Pick<Props, 'saveStatus' | 'lastSavedAt' | 'onSaveRetry'>) {
  const text = useMemo(() => {
    if (saveStatus === 'idle') return '草稿未变更';
    if (saveStatus === 'saving') return '保存中…';
    if (saveStatus === 'error') return '保存失败，点击重试';
    const t = lastSavedAt
      ? lastSavedAt.toLocaleTimeString('zh-CN', { hour12: false })
      : '--:--:--';
    return `已保存草稿 · ${t}`;
  }, [lastSavedAt, saveStatus]);

  const clickable = saveStatus === 'error';

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => (clickable ? onSaveRetry() : null)}
      className={cn(
        'inline-flex items-center gap-2 text-sm tabular-nums',
        saveStatus === 'idle' ? 'text-slate-500' : '',
        saveStatus === 'saving' ? 'text-sky-700' : '',
        saveStatus === 'saved' ? 'text-emerald-700' : '',
        saveStatus === 'error' ? 'text-rose-700 hover:underline' : '',
        clickable ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      {saveStatus === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {saveStatus === 'saved' ? (
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
      ) : null}
      {saveStatus === 'error' ? <AlertTriangle className="h-4 w-4" /> : null}
      <span>{text}</span>
    </button>
  );
}

export function PromptEditorHeader({
  detail,
  saveStatus,
  lastSavedAt,
  onSaveRetry,
  onBack,
  onOpenVersions,
  onOpenMeta,
  onOpenDiscard,
  onSaveVersion,
  testOpen,
  testRunning,
  onToggleTest,
}: Props) {
  const enabled = detail.status === 'ENABLED';

  return (
    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <div className="min-w-0 text-sm font-semibold text-slate-900">{detail.name}</div>
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
            {detail.sceneKey}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-700">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                enabled ? 'bg-emerald-500' : 'bg-slate-300',
              )}
            />
            {enabled ? '启用' : '禁用'}
          </span>
        </div>

        <div className="hidden sm:flex sm:flex-1 sm:justify-center">
          <SaveStatusIndicator
            saveStatus={saveStatus}
            lastSavedAt={lastSavedAt}
            onSaveRetry={onSaveRetry}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={onOpenVersions}
            >
              <History className="h-4 w-4" />
              版本历史
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              className="sm:hidden"
              onClick={onOpenVersions}
              title="版本历史"
            >
              <History className="h-4 w-4" />
            </Button>

            <Button
              variant="secondary"
              size="sm"
              className={cn(
                'hidden sm:inline-flex',
                testOpen ? 'bg-sky-100 text-sky-700 hover:bg-sky-100' : '',
              )}
              onClick={onToggleTest}
            >
              <span className="relative inline-flex items-center">
                <TestTube2 className={cn('h-4 w-4', testRunning ? 'animate-pulse' : '')} />
                {testRunning ? (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                ) : null}
              </span>
              测试
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              className={cn('sm:hidden', testOpen ? 'bg-sky-100 text-sky-700 hover:bg-sky-100' : '')}
              onClick={onToggleTest}
              title="测试"
            >
              <span className="relative inline-flex items-center">
                <TestTube2 className={cn('h-4 w-4', testRunning ? 'animate-pulse' : '')} />
                {testRunning ? (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                ) : null}
              </span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={onOpenMeta}
            >
              <Settings className="h-4 w-4" />
              元信息
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              className="sm:hidden"
              onClick={onOpenMeta}
              title="元信息"
            >
              <Settings className="h-4 w-4" />
            </Button>

            <Button
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={onOpenDiscard}
            >
              <Undo2 className="h-4 w-4" />
              丢弃草稿
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              className="sm:hidden"
              onClick={onOpenDiscard}
              title="丢弃草稿"
            >
              <Undo2 className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              className="hidden sm:inline-flex"
              onClick={onSaveVersion}
            >
              <Rocket className="h-4 w-4" />
              保存为新版本
            </Button>
            <Button
              size="icon-sm"
              className="sm:hidden"
              onClick={onSaveVersion}
              title="保存为新版本"
            >
              <Rocket className="h-4 w-4" />
            </Button>
          </div>

          <div className="sm:hidden">
            <SaveStatusIndicator
              saveStatus={saveStatus}
              lastSavedAt={lastSavedAt}
              onSaveRetry={onSaveRetry}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
