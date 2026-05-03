'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { createPrompt } from '@/services/admin/prompts';

const SCENE_KEY_RE = /^[a-z][a-z0-9_.-]{1,63}$/;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}

export function CreatePromptDialog({ open, onOpenChange, onCreated }: Props) {
  const sceneKeyRef = useRef<HTMLInputElement | null>(null);

  const [sceneKey, setSceneKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSceneKey('');
    setName('');
    setDescription('');
    setTagsInput('');
    setTags([]);
    setErr(null);
    setTimeout(() => sceneKeyRef.current?.focus(), 50);
  }, [open]);

  const sceneKeyValid = useMemo(() => SCENE_KEY_RE.test(sceneKey), [sceneKey]);
  const nameTooLong = name.length > 50;
  const canSubmit = sceneKeyValid && name.trim().length > 0 && !nameTooLong && !submitting;

  function addTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (t.length > 16) return;
    setTags((prev) => {
      if (prev.includes(t)) return prev;
      if (prev.length >= 5) return prev;
      return [...prev, t];
    });
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setErr(null);
    try {
      const created = await createPrompt({
        code: sceneKey,
        name: name.trim(),
        scene: 'OTHER',
        description: description.trim() || undefined,
      });
      toast.success('模板已创建');
      onOpenChange(false);
      onCreated(created.id);
    } catch (e: any) {
      const code = e?.code;
      const msg = e?.message || '创建失败';
      if (code === 409) setErr('sceneKey 已存在，请更换');
      else setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!submitting ? onOpenChange(v) : null)}>
      <DialogContent
        className="mx-4 sm:mx-0 sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (submitting) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (submitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            新建模板
          </DialogTitle>
          <DialogDescription>创建后进入编辑页（编辑器在 7A-2 实现）</DialogDescription>
        </DialogHeader>

        {err ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-700">
              sceneKey <span className="text-rose-500">*</span>
            </div>
            <Input
              ref={sceneKeyRef}
              value={sceneKey}
              onChange={(e) => setSceneKey(e.target.value)}
              placeholder="article.expand"
              disabled={submitting}
              aria-invalid={!sceneKeyValid && sceneKey.length > 0}
              className={cn(
                'h-9 font-mono',
                !sceneKeyValid && sceneKey.length > 0 ? 'border-rose-300' : '',
              )}
            />
            <div className="text-xs text-slate-500">
              小写字母开头，仅含小写字母 / 数字 / . / _ / -，2~64 字符
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-700">
              名称 <span className="text-rose-500">*</span>
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：文章扩写"
              disabled={submitting}
              aria-invalid={nameTooLong}
              className={cn('h-9', nameTooLong ? 'border-rose-300' : '')}
            />
            {nameTooLong ? (
              <div className="text-xs text-rose-600">已超过 50 字</div>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-700">描述</div>
              <div className="text-xs text-slate-400">{description.length}/200</div>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              rows={2}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Tags</div>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                addTag(tagsInput);
                setTagsInput('');
              }}
              placeholder="输入后回车添加（最多 5 个）"
              disabled={submitting}
              className="h-9"
            />
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                      disabled={submitting}
                      className="rounded p-0.5 hover:bg-slate-200 disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? '创建中…' : '创建并编辑'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

