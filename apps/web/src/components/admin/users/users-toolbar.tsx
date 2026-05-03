'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ListUsersQuery } from '@/types/admin/user';

interface Props {
  query: ListUsersQuery;
  onChange: (next: ListUsersQuery) => void;
  onReload: () => void;
  loading?: boolean;
}

export function UsersToolbar({ query, onChange, onReload, loading }: Props) {
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
    }, 400);
    return () => clearTimeout(t);
  }, [keyword, query, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-4">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索手机号 / 昵称 / 邮箱"
          className="pl-9"
        />
      </div>

      <Select
        value={query.status ?? 'ALL'}
        onValueChange={(v) =>
          onChange({
            ...query,
            status: v as ListUsersQuery['status'],
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">全部状态</SelectItem>
          <SelectItem value="ACTIVE">正常</SelectItem>
          <SelectItem value="DISABLED">已停用</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        onClick={onReload}
        disabled={loading}
        title="刷新"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
