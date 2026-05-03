'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Variable } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { PromptVariable } from '@/types/prompt';
import { PromptVariableRow } from './PromptVariableRow';

interface Props {
  variables: PromptVariable[];
  onChange: (vs: PromptVariable[]) => void;
  onUpdate: (idx: number, patch: Partial<PromptVariable>) => void;
  diff: { added: string[]; removed: string[] };
  hasDiff: boolean;
  onSync: () => void;
}

const NEW_VAR_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function Chip({ text }: { text: string }) {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs text-amber-800">
      {text}
    </span>
  );
}

export function PromptVariablePanel({
  variables,
  onChange,
  onUpdate,
  diff,
  hasDiff,
  onSync,
}: Props) {
  const [ignoredFingerprint, setIgnoredFingerprint] = useState<string | null>(null);
  const fingerprint = useMemo(() => JSON.stringify(diff), [diff]);
  const showBanner = hasDiff && ignoredFingerprint !== fingerprint;

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const newNameTrim = newName.trim();
  const nameValid = NEW_VAR_RE.test(newNameTrim) && newNameTrim.length <= 30;
  const nameExists = variables.some((v) => v.name === newNameTrim);
  const canCreate = nameValid && !nameExists;

  function addVariable(name: string) {
    const next: PromptVariable = {
      name,
      label: name,
      type: 'text',
      required: true,
      defaultValue: '',
      description: '',
    };
    onChange([...variables, next]);
    toast.success(`变量已新增，在内容中使用 {{${name}}} 引用`);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">
          变量配置 ({variables.length})
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          新增变量
        </Button>
      </div>

      {showBanner ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                内容与变量列表不一致
              </div>

              {diff.added.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-slate-700">
                  <span className="text-xs text-amber-700">新增：</span>
                  <div className="flex flex-wrap gap-1">
                    {diff.added.map((n) => (
                      <Chip key={n} text={n} />
                    ))}
                  </div>
                </div>
              ) : null}

              {diff.removed.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-slate-700">
                  <span className="text-xs text-amber-700">移除：</span>
                  <div className="flex flex-wrap gap-1">
                    {diff.removed.map((n) => (
                      <Chip key={n} text={n} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" onClick={onSync}>
                一键同步
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIgnoredFingerprint(fingerprint)}
              >
                忽略
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        {variables.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            <div className="flex justify-center">
              <Variable className="h-6 w-6 text-slate-400" />
            </div>
            <div className="mt-2">暂无变量。在内容中输入 {'{{name}}'} 自动识别</div>
          </div>
        ) : (
          variables.map((v, idx) => (
            <PromptVariableRow
              key={v.name}
              index={idx}
              value={v}
              onUpdate={(patch) => onUpdate(idx, patch)}
              onRemove={() => {
                onChange(variables.filter((_, i) => i !== idx));
                toast.success('已删除');
              }}
            />
          ))
        )}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (v) setNewName('');
        }}
      >
        <DialogContent className="mx-4 sm:mx-0 sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>新增变量</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-xs text-gray-500">变量名</div>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value.slice(0, 30))}
              placeholder="role"
              className={cn('h-9 font-mono', newName && (!nameValid || nameExists) ? 'border-rose-300' : '')}
              autoFocus
            />
            {!nameValid && newNameTrim ? (
              <div className="text-xs text-rose-600">
                仅允许字母/数字/_，且需以字母或 _ 开头（最多 30）
              </div>
            ) : null}
            {nameValid && nameExists ? (
              <div className="text-xs text-rose-600">变量名已存在</div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              disabled={!canCreate}
              onClick={() => {
                if (!canCreate) return;
                setCreateOpen(false);
                addVariable(newNameTrim);
              }}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

