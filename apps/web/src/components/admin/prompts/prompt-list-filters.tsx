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
import type { PromptListQuery, PromptSceneMeta, PromptStatus } from '@/types/admin/prompt';

interface Props {
  query: PromptListQuery;
  allScenes: PromptSceneMeta[];
  onChange: (patch: Partial<PromptListQuery>) => void;
}

const STATUS_ITEMS: Array<{ key: 'ALL' | PromptStatus; label: string }> = [
  { key: 'ALL', label: '全部' },
  { key: 'ACTIVE', label: '启用' },
  { key: 'DRAFT', label: '禁用' },
];

export function PromptListFilters({ query, allScenes, onChange }: Props) {
  const [keyword, setKeyword] = useState(query.keyword ?? '');

  useEffect(() => {
    const t = setTimeout(() => {
      if ((query.keyword ?? '') !== keyword) onChange({ keyword, page: 1 });
    }, 300);
    return () => clearTimeout(t);
  }, [keyword, onChange, query.keyword]);

  const scenesSelected = useMemo(() => query.scenes ?? [], [query.scenes]);
  const hasScenes = allScenes.length > 0;

  const status = query.status ?? 'ALL';
  const isDirty =
    (query.keyword ?? '') !== '' ||
    (query.scenes?.length ?? 0) > 0 ||
    (query.status ?? 'ALL') !== 'ALL';

  const sceneLabel = useMemo(() => {
    if (!scenesSelected.length) return '全部场景';
    const names = scenesSelected
      .map((v) => allScenes.find((s) => s.value === v)?.label || v)
      .slice(0, 2);
    const more = scenesSelected.length - names.length;
    return more > 0 ? `${names.join('、')} +${more}` : names.join('、');
  }, [allScenes, scenesSelected]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索名称 / code / 描述"
          className="h-9 pl-9"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasScenes}
            title={hasScenes ? undefined : '暂无场景'}
          >
            {sceneLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>场景筛选</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {allScenes.map((s) => {
            const checked = scenesSelected.includes(s.value);
            return (
              <DropdownMenuCheckboxItem
                key={s.value}
                checked={checked}
                onCheckedChange={(v) => {
                  const next = new Set(scenesSelected);
                  if (v) next.add(s.value);
                  else next.delete(s.value);
                  onChange({ scenes: Array.from(next), page: 1 });
                }}
              >
                {s.label}
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
              onClick={() => onChange({ status: it.key, page: 1 })}
              className={cn(
                'rounded px-3 py-1 text-sm',
                active
                  ? 'border border-indigo-200 bg-indigo-50 font-medium text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>

      {isDirty ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              page: 1,
              pageSize: 20,
              keyword: '',
              status: 'ALL',
              scenes: [],
            })
          }
        >
          重置
        </Button>
      ) : null}
    </div>
  );
}
