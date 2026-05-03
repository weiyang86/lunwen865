'use client';

import { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { PromptVariable } from '@/types/prompt';
import { extractVariableNames } from '../utils/parseVariables';

const MAX_CONTENT_LENGTH = 16000;
const NEW_VAR_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

interface Props {
  content: string;
  onChange: (v: string) => void;
  variables: PromptVariable[];
  onCreateVariable: (name: string) => void;
}

export function PromptEditorPane({ content, onChange, variables, onCreateVariable }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumRef = useRef<HTMLDivElement | null>(null);

  const [newVarOpen, setNewVarOpen] = useState(false);
  const [newVarName, setNewVarName] = useState('');

  const lines = useMemo(() => Math.max(1, content.split('\n').length), [content]);
  const lineNumbers = useMemo(() => Array.from({ length: lines }, (_, i) => i + 1), [lines]);

  const contentVars = useMemo(() => extractVariableNames(content), [content]);
  const variableNames = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const v of variables) {
      if (!v?.name) continue;
      if (seen.has(v.name)) continue;
      seen.add(v.name);
      out.push(v.name);
    }
    return out;
  }, [variables]);

  const charCount = content.length;
  const charCls =
    charCount > MAX_CONTENT_LENGTH
      ? 'text-rose-600'
      : charCount > 14000
        ? 'text-orange-600'
        : 'text-slate-500';

  const newVarValid = NEW_VAR_RE.test(newVarName) && newVarName.length <= 30;

  function insertAtCursor(text: string) {
    const ta = textareaRef.current;
    if (!ta) {
      onChange(content + text);
      return;
    }
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    const next = content.slice(0, start) + text + content.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">提示词内容</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              <Plus className="h-4 w-4" />
              插入变量
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {variableNames.length === 0 ? (
              <DropdownMenuItem disabled>
                暂无变量。先在右侧面板新增或在内容中输入 {'{{name}}'}
              </DropdownMenuItem>
            ) : (
              variableNames.map((v) => (
                <DropdownMenuItem key={v} onSelect={() => insertAtCursor(`{{${v}}}`)}>
                  {v}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                setNewVarName('');
                setNewVarOpen(true);
              }}
            >
              新建变量…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex h-96 overflow-hidden rounded-md border border-slate-200">
        <div
          ref={lineNumRef}
          className="w-12 select-none overflow-hidden bg-slate-50 py-3 pr-2 text-right font-mono text-sm leading-6 tabular-nums text-slate-400"
        >
          {lineNumbers.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (lineNumRef.current) lineNumRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          className="flex-1 resize-none overflow-auto px-3 py-3 font-mono text-sm leading-6 outline-none"
          spellCheck={false}
          placeholder="输入提示词内容，使用 {{变量名}} 引用变量"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs tabular-nums text-slate-500">
        <div className={cn(charCls)}>
          字符: {charCount} / {MAX_CONTENT_LENGTH}
        </div>
        <div>变量: {contentVars.length} 个</div>
      </div>

      <Dialog open={newVarOpen} onOpenChange={setNewVarOpen}>
        <DialogContent className="mx-4 sm:mx-0 sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>新建变量</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-xs text-gray-500">变量名</div>
            <Input
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value.slice(0, 30))}
              placeholder="role"
              className={cn('h-9 font-mono', newVarName && !newVarValid ? 'border-rose-300' : '')}
              autoFocus
            />
            <div className="text-xs text-slate-500">^[a-zA-Z_][a-zA-Z0-9_]*$，最多 30</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewVarOpen(false)}>
              取消
            </Button>
            <Button
              disabled={!newVarValid}
              onClick={() => {
                const name = newVarName.trim();
                if (!NEW_VAR_RE.test(name) || name.length > 30) return;
                setNewVarOpen(false);
                insertAtCursor(`{{${name}}}`);
                onCreateVariable(name);
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
