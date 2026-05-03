'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PromptDraft } from '@/types/prompt';
import { PromptTestHistoryList } from './PromptTestHistoryList';
import { PromptTestRunner, type TestRunRecord } from './PromptTestRunner';
import { PromptTestVariablesForm } from './PromptTestVariablesForm';

type TabKey = 'run' | 'history';

export function PromptTestPanel({
  open,
  onClose,
  promptId,
  baseVersionNo,
  isDirty,
  draftSnapshot,
  onRunningChange,
}: {
  open: boolean;
  onClose: () => void;
  promptId: string;
  baseVersionNo: number | null;
  isDirty: boolean;
  draftSnapshot: PromptDraft;
  onRunningChange: (running: boolean) => void;
}) {
  const [tab, setTab] = useState<TabKey>('run');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [valid, setValid] = useState(true);
  const [invalidReason, setInvalidReason] = useState<string | undefined>(undefined);
  const [overrides, setOverrides] = useState<{ temperature?: number; maxTokens?: number }>({});
  const [running, setRunning] = useState(false);

  const [records, setRecords] = useState<TestRunRecord[]>([]);

  const subtitle = useMemo(() => {
    const v = baseVersionNo ? `v${baseVersionNo}` : '未发布';
    return `基于 ${v} 草稿${isDirty ? '（已修改）' : ''}`;
  }, [baseVersionNo, isDirty]);

  const canRun = valid;

  const onFinished = useCallback((r: TestRunRecord) => {
    setRecords((prev) => [r, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab('run');
  }, [open]);

  const wrapperCls = cn(
    'bg-white md:bg-transparent',
    open ? '' : 'pointer-events-none opacity-0 md:opacity-100 md:pointer-events-auto',
    'fixed inset-0 z-40 md:static md:z-auto',
    'md:w-80 lg:w-96',
    open ? '' : 'md:w-0 md:overflow-hidden',
  );

  return (
    <div className={wrapperCls}>
      <div className={cn(open ? 'block' : 'hidden md:block')}>
        <div className="h-full w-full bg-white md:rounded-lg md:border md:border-slate-200 md:shadow-sm">
          <div className="flex items-start justify-between border-b border-slate-200 p-4">
            <div>
              <div className="text-base font-semibold text-slate-900">测试运行</div>
              <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="关闭">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
            <button
              type="button"
              onClick={() => setTab('run')}
              className={cn(
                'px-3 py-2 text-sm -mb-px border-b-2 focus:outline-none',
                tab === 'run'
                  ? 'font-medium text-primary border-primary'
                  : 'text-slate-500 hover:text-slate-700 border-transparent',
              )}
            >
              运行
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={cn(
                'px-3 py-2 text-sm -mb-px border-b-2 focus:outline-none',
                tab === 'history'
                  ? 'font-medium text-primary border-primary'
                  : 'text-slate-500 hover:text-slate-700 border-transparent',
              )}
            >
              历史 ({records.length})
            </button>
          </div>

          <div className="p-4">
            {tab === 'run' ? (
              <div className="space-y-4">
                <PromptTestVariablesForm
                  variables={draftSnapshot.variables}
                  disabled={running}
                  values={values}
                  onChangeValues={setValues}
                  onValidityChange={(ok, reason) => {
                    setValid(ok);
                    setInvalidReason(reason);
                  }}
                  overrides={overrides}
                  onChangeOverrides={setOverrides}
                />

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <PromptTestRunner
                    promptId={promptId}
                    draftSnapshot={draftSnapshot}
                    variableValues={values}
                    overrides={overrides}
                    timeoutMs={60_000}
                    canRun={canRun}
                    disabledReason={invalidReason}
                    onFinished={onFinished}
                    onRunningChange={(v) => {
                      setRunning(v);
                      onRunningChange(v);
                    }}
                  />
                </div>
              </div>
            ) : null}

            {tab === 'history' ? (
              <PromptTestHistoryList
                records={records}
                onClear={() => setRecords([])}
                onLoadValues={(v) => {
                  setValues(v);
                  setTab('run');
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
