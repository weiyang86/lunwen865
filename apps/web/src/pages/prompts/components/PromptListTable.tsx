'use client';

import { Copy, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/format';
import type { PromptTemplate } from '@/types/prompt';

interface Props {
  rows: PromptTemplate[];
  loading: boolean;
  onRowClick: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (row: PromptTemplate) => void;
}

export function PromptListTable({ rows, loading, onRowClick, onEdit, onDelete }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <Table className="w-max min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>当前版本</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>更新人</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            rows.map((r) => {
              const tags = r.tags ?? [];
              const showTags = tags.slice(0, 3);
              const more = Math.max(0, tags.length - showTags.length);
              const enabled = r.status === 'ENABLED';

              return (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => onRowClick(r.id)}
                >
                  <TableCell>
                    <div className="group min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {r.name}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <span className="truncate font-mono">{r.sceneKey}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigator.clipboard
                              .writeText(r.sceneKey)
                              .then(() => toast.success('已复制'));
                          }}
                          title="复制 sceneKey"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {tags.length === 0 ? (
                      <span className="text-sm text-slate-400">—</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {showTags.map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                        {more > 0 ? (
                          <span className="text-xs text-slate-500">+{more}</span>
                        ) : null}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    {r.currentVersionNo ? (
                      <div>
                        <Badge variant="outline">v{r.currentVersionNo}</Badge>
                        <div className="mt-1 text-xs text-slate-500">
                          更新于 {formatRelativeTime(r.updatedAt)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">未发布</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          enabled ? 'bg-emerald-500' : 'bg-slate-300',
                        )}
                      />
                      <span className="text-sm text-slate-700">
                        {enabled ? '启用' : '禁用'}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    {r.updatedBy ? (
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          {r.updatedBy.avatar ? (
                            <AvatarImage src={r.updatedBy.avatar} />
                          ) : null}
                          <AvatarFallback>
                            {(r.updatedBy.name || '—').slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-slate-700">{r.updatedBy.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(r.id);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(r);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

