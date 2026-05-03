'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { PromptListQuery, PromptStatus } from '@/types/prompt';

const STATUS_ITEMS: Array<{ key: 'ALL' | PromptStatus; label: string }> = [
  { key: 'ALL', label: '全部' },
  { key: 'ENABLED', label: '启用' },
  { key: 'DISABLED', label: '禁用' },
];

interface Props {
  query: PromptListQuery;
  allTags: string[];
  onChange: (patch: Partial<PromptListQuery>) => void;
  onReset: () => void;
}

export function PromptListFilters({ query, allTags, onChange, onReset }: Props) {
  const [keyword, setKeyword] = useState(query.keyword ?? '');

  useEffect(() => {
    setKeyword(query.keyword ?? '');
  }, [query.keyword]);

  useEffect(() => {
    const t = setTimeout(() => {
      const prev = query.keyword ?? '';
      if (prev !== keyword) onChange({ keyword: keyword || undefined });
    }, 300);
    return () => clearTimeout(t);
  }, [keyword, onChange, query.keyword]);

  const hasTags = allTags.length > 0;
  const selectedTags = query.tags ?? [];

  const tagLabel = useMemo(() => {
    if (selectedTags.length === 0) return 'Tags：全部';
    if (selectedTags.length <= 2) return `Tags：${selectedTags.join(', ')}`;
    return `Tags：${selectedTags.slice(0, 2).join(', ')} +${selectedTags.length - 2}`;
  }, [selectedTags]);

  const status = query.status ?? 'ALL';

  const showReset =
    (query.keyword ?? '') !== '' ||
    (query.tags?.length ?? 0) > 0 ||
    (query.status ?? undefined) !== undefined;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索名称 / sceneKey / 描述"
          className="h-9 pl-9"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasTags}
            title={hasTags ? undefined : '暂无标签'}
            className="h-9"
          >
            {tagLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Tag 筛选</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {allTags.map((t) => {
            const checked = selectedTags.includes(t);
            return (
              <DropdownMenuCheckboxItem
                key={t}
                checked={checked}
                onCheckedChange={(v) => {
                  const next = new Set(selectedTags);
                  if (v) next.add(t);
                  else next.delete(t);
                  onChange({ tags: Array.from(next) });
                }}
              >
                {t}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center rounded-md border border-slate-200 bg-white p-1">
        {STATUS_ITEMS.map((it) => {
          const active = status === it.key;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onChange({ status: it.key === 'ALL' ? undefined : it.key })}
              className={cn(
                'rounded border px-3 py-1 text-sm transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-600 hover:bg-slate-50',
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>

      {showReset ? (
        <Button variant="ghost" size="sm" onClick={onReset}>
          重置
        </Button>
      ) : null}
    </div>
  );
}
