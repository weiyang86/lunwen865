'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  initial: { title: string; description: string; tags: string[] };
  onClose: () => void;
  onSave: (next: { title: string; description: string; tags: string[] }) => void;
}

const TAG_RE = /^[\p{L}\p{N}_-]+$/u;

export function PromptMetadataDialog({ open, initial, onClose, onSave }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [tagEditing, setTagEditing] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(initial.title);
    setDescription(initial.description);
    setTags(initial.tags);
    setTagEditing(false);
    setTagInput('');
  }, [initial.description, initial.tags, initial.title, open]);

  const titleOk = useMemo(() => title.trim().length > 0 && title.trim().length <= 100, [title]);
  const canSave = titleOk;

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  function tryAddTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (t.length > 20) {
      toast.error('标签长度需为 1-20');
      return;
    }
    if (!TAG_RE.test(t)) {
      toast.error('标签仅允许中文/英文/数字/-/_，不可包含空格');
      return;
    }
    setTags((prev) => {
      if (prev.includes(t)) return prev;
      if (prev.length >= 10) {
        toast.error('最多 10 个标签');
        return prev;
      }
      return [...prev, t];
    });
  }

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Dialog.Title className="text-base font-semibold text-slate-900">
                      元信息
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-slate-500">
                      编辑标题 / 描述 / 标签
                    </Dialog.Description>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    aria-label="关闭"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500">
                      标题 <span className="text-rose-500">*</span>
                    </div>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                      className={cn('h-9', title && !titleOk ? 'border-rose-300' : '')}
                    />
                    <div className="text-xs text-slate-500">1-100 字</div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">描述</div>
                      <div className="text-xs text-slate-400">{description.length}/500</div>
                    </div>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                      rows={3}
                    />
                    <div className="text-xs text-slate-500">0-500 字</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">标签</div>
                      <div className="text-xs text-slate-500">最多 10 个</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-700"
                        >
                          {t}
                          <button
                            type="button"
                            onClick={() => removeTag(t)}
                            className="rounded p-0.5 hover:bg-sky-100"
                            aria-label={`移除 ${t}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}

                      {tagEditing ? (
                        <Input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setTagEditing(false);
                              setTagInput('');
                              return;
                            }
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            tryAddTag(tagInput);
                            setTagInput('');
                            setTagEditing(false);
                          }}
                          onBlur={() => {
                            tryAddTag(tagInput);
                            setTagInput('');
                            setTagEditing(false);
                          }}
                          placeholder="回车添加"
                          className="h-8 w-32"
                          autoFocus
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTagEditing(true)}
                        >
                          + 添加标签
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>
                    取消
                  </Button>
                  <Button
                    onClick={() => {
                      if (!canSave) return;
                      onSave({ title: title.trim(), description, tags });
                      onClose();
                    }}
                    disabled={!canSave}
                  >
                    保存
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

