'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ProductListQuery, ProductStatus } from '@/types/admin/product';

interface Props {
  query: ProductListQuery;
  onChange: (patch: Partial<ProductListQuery>) => void;
  categoryLockedAll: boolean;
}

export function ProductFilterBar({ query, onChange, categoryLockedAll }: Props) {
  const [keyword, setKeyword] = useState(query.keyword ?? '');

  useEffect(() => {
    const t = setTimeout(() => {
      if ((query.keyword ?? '') !== keyword) onChange({ keyword, page: 1 });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const showReset =
    (query.keyword ?? '') !== '' ||
    (query.status ?? 'ALL') !== 'ALL' ||
    (query.includeSubCategory ?? true) !== true;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索商品名 / 编码"
          className="h-9 pl-9"
        />
      </div>

      <Select
        value={(query.status ?? 'ALL') as string}
        onValueChange={(v) => onChange({ status: v as ProductStatus | 'ALL', page: 1 })}
      >
        <SelectTrigger className="h-9 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">全部状态</SelectItem>
          <SelectItem value="ON_SALE">在售</SelectItem>
          <SelectItem value="OFF_SHELF">已下架</SelectItem>
          <SelectItem value="DRAFT">草稿</SelectItem>
        </SelectContent>
      </Select>

      <label
        className={cn(
          'flex items-center gap-2 text-sm text-slate-700',
          categoryLockedAll ? 'opacity-60' : '',
        )}
        title={categoryLockedAll ? '全部商品默认包含子分类' : undefined}
      >
        <input
          type="checkbox"
          checked={query.includeSubCategory ?? true}
          disabled={categoryLockedAll}
          onChange={(e) => onChange({ includeSubCategory: e.target.checked, page: 1 })}
        />
        包含子分类
      </label>

      {showReset ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({ keyword: '', status: 'ALL', includeSubCategory: true, page: 1 })
          }
        >
          重置
        </Button>
      ) : null}
    </div>
  );
}

