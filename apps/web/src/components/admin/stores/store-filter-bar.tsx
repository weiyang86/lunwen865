'use client';

import { useEffect, useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StoreListQuery } from '@/types/admin/store';

interface Props {
  query: StoreListQuery;
  onChange: (next: StoreListQuery) => void;
}

export function StoreFilterBar({ query, onChange }: Props) {
  const [keyword, setKeyword] = useState(query.keyword ?? '');

  useEffect(() => {
    setKeyword(query.keyword ?? '');
  }, [query.keyword]);

  useEffect(() => {
    const t = setTimeout(() => {
      const prev = query.keyword ?? '';
      if (prev !== keyword) {
        onChange({ ...query, keyword, page: 1 });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [keyword, query, onChange]);

  const showReset = useMemo(() => {
    return Boolean((query.keyword ?? '').trim()) || (query.status ?? 'ALL') !== 'ALL';
  }, [query.keyword, query.status]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-4">
      <Input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索名称 / 地址"
        className="h-10 w-64"
      />

      <Select
        value={query.status ?? 'ALL'}
        onValueChange={(v) =>
          onChange({ ...query, status: v as StoreListQuery['status'], page: 1 })
        }
      >
        <SelectTrigger className="h-10 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">全部</SelectItem>
          <SelectItem value="OPEN">营业中</SelectItem>
          <SelectItem value="PAUSED">已暂停</SelectItem>
          <SelectItem value="CLOSED">已关闭</SelectItem>
        </SelectContent>
      </Select>

      {showReset && (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...query,
              keyword: '',
              status: 'ALL',
              page: 1,
            })
          }
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          重置
        </button>
      )}
    </div>
  );
}

