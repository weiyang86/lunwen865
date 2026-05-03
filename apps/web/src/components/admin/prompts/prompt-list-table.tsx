'use client';

import { Copy, Trash2, Pencil } from 'lucide-react';
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
import type { PromptSceneMeta, PromptTemplate } from '@/types/admin/prompt';
import { formatDateTime, formatRelativeTime } from '@/utils/format';

function statusView(status: PromptTemplate['status']) {
  if (status === 'ACTIVE')
    return { label: '启用', cls: 'text-emerald-700', dot: 'bg-emerald-500' };
  if (status === 'ARCHIVED')
    return { label: '归档', cls: 'text-slate-500', dot: 'bg-slate-400' };
  return { label: '草稿', cls: 'text-slate-500', dot: 'bg-slate-400' };
}

interface Props {
  rows: PromptTemplate[];
  loading: boolean;
  scenes: PromptSceneMeta[];
  onRowClick: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (row: PromptTemplate) => void;
}

export function PromptListTable({
  rows,
  loading,
  scenes,
  onRowClick,
  onEdit,
  onDelete,
}: Props) {
  const sceneLabel = (v: string) => scenes.find((s) => s.value === v)?.label || v;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <div className="min-w-[768px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[320px]">名称</TableHead>
              <TableHead className="w-[220px]">场景</TableHead>
              <TableHead className="w-[160px]">当前版本</TableHead>
              <TableHead className="w-[120px]">状态</TableHead>
              <TableHead className="w-[160px]">更新人</TableHead>
              <TableHead className="w-[180px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-slate-500">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const st = statusView(r.status);
                const canDelete = r.status === 'DRAFT';
                return (
                  <TableRow
                    key={r.id}
                    className="group cursor-pointer hover:bg-slate-50"
                    onClick={() => onRowClick(r.id)}
                  >
                    <TableCell>
                      <div className="text-sm font-semibold text-slate-900">{r.name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">{r.code}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigator.clipboard.writeText(r.code);
                          }}
                          title="复制 code"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {sceneLabel(r.scene)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.currentVersion ? (
                        <div>
                          <div className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            v{r.currentVersion}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            更新于 {formatRelativeTime(r.updatedAt)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">未发布</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className={cn('flex items-center gap-2 text-sm', st.cls)}>
                        <span className={cn('h-2 w-2 rounded-full', st.dot)} />
                        {st.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-700">{r.updatedBy || '—'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDateTime(r.updatedAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-3">
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
                          disabled={!canDelete}
                          title={canDelete ? '删除' : '仅草稿可删除'}
                          className="text-rose-600 hover:text-rose-700 disabled:opacity-40"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canDelete) onDelete(r);
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
    </div>
  );
}

