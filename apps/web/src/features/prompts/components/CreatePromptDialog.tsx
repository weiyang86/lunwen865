'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
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
import { promptApi } from '@/api/prompts';

const SCENE_KEY_RE = /^[a-z][a-z0-9_.-]{1,63}$/;
const EXAMPLE = {
  sceneKey: 'paper.abstract.generate',
  name: '论文摘要生成（示例）',
  description: '示例模板：生成论文中英文摘要（供新增时参考）',
  tags: ['论文', '摘要', '示例'],
  content: `你是一名中文学术论文写作助手，请基于输入信息生成【中文摘要】与【英文摘要】。

【论文标题】{{title}}
【研究方向】{{topic}}
【目标字数】{{wordCount}}
【关键词】{{keywords}}

要求：
1) 中文摘要与英文摘要各一段，结构清晰，避免口语化。
2) 不要输出除摘要与关键词之外的任何内容。
3) 若信息不足，请合理补全但不要编造具体数据来源。

输出格式：
中文摘要：
...

关键词：...（3-5 个）

英文摘要：
...

Key words: ... (3-5)`,
  variables: [
    {
      name: 'title',
      label: '论文标题',
      type: 'text',
      required: true,
      defaultValue: '数字经济背景下中小企业融资问题研究',
      description: '论文最终标题',
    },
    {
      name: 'topic',
      label: '研究方向',
      type: 'textarea',
      required: true,
      defaultValue: '聚焦供应链金融与中小企业融资约束，关注 2022-2026 年政策与案例。',
      description: '研究对象/方向/边界条件',
    },
    {
      name: 'wordCount',
      label: '目标字数',
      type: 'number',
      required: true,
      defaultValue: '300',
      description: '摘要目标字数（仅作为参考）',
    },
    {
      name: 'keywords',
      label: '关键词',
      type: 'text',
      required: false,
      defaultValue: '数字经济；中小企业；融资约束；供应链金融',
      description: '可选，若不填由模型生成 3-5 个',
    },
  ],
} as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
  prefillExample?: boolean;
}

export function CreatePromptDialog({ open, onOpenChange, onCreated, prefillExample }: Props) {
  const sceneKeyRef = useRef<HTMLInputElement | null>(null);

  const [sceneKey, setSceneKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSceneKey('');
    setName('');
    setDescription('');
    setTagsInput('');
    setTags([]);
    setCopied(null);
    setErr(null);
    if (prefillExample) {
      setSceneKey(EXAMPLE.sceneKey);
      setName(EXAMPLE.name);
      setDescription(EXAMPLE.description);
      setTags(EXAMPLE.tags.slice());
    }
    setTimeout(() => sceneKeyRef.current?.focus(), 50);
  }, [open, prefillExample]);

  const sceneKeyValid = useMemo(() => SCENE_KEY_RE.test(sceneKey), [sceneKey]);
  const nameTooLong = name.length > 50;
  const canSubmit =
    sceneKeyValid && name.trim().length > 0 && !nameTooLong && !submitting;

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
      const created = await promptApi.create({
        sceneKey,
        name: name.trim(),
        description: description.trim(),
        tags,
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
          <DialogDescription>
            创建后进入编辑页，可配置 Prompt 内容/变量/模型参数，并保存为新版本发布
          </DialogDescription>
        </DialogHeader>

        {err ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">模板案例（可复制）</div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSceneKey(EXAMPLE.sceneKey);
                    setName(EXAMPLE.name);
                    setDescription(EXAMPLE.description);
                    setTags(EXAMPLE.tags.slice());
                    setTagsInput('');
                    setErr(null);
                    toast.success('已填入示例字段');
                  }}
                  disabled={submitting}
                >
                  一键填入示例
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const text =
                      `【Prompt 内容示例】\n\n${EXAMPLE.content}\n\n` +
                      `【变量配置示例(JSON)】\n${JSON.stringify(EXAMPLE.variables, null, 2)}`;
                    void navigator.clipboard
                      .writeText(text)
                      .then(() => {
                        setCopied('example');
                        setTimeout(() => setCopied(null), 1200);
                      })
                      .catch(() => toast.error('复制失败，请手动复制'));
                  }}
                  disabled={submitting}
                >
                  {copied === 'example' ? '已复制' : '复制示例内容'}
                </Button>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              规则：在 Prompt 内容里用 <span className="font-mono">{'{{变量名}}'}</span> 引用变量，并在“变量配置”里声明同名变量
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-gray-500">
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
                err?.includes('sceneKey') ? 'border-rose-300' : '',
              )}
            />
            <div className="text-xs text-slate-500">
              小写字母开头，仅含小写字母 / 数字 / . / _ / -，2~64 字符
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-gray-500">
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
              <div className="text-xs text-gray-500">描述</div>
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
            <div className="text-xs text-gray-500">tags</div>
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
                      aria-label={`移除 ${t}`}
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? '创建中…' : '创建并编辑'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
