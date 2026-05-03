'use client';

import { useMemo, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import type { PromptTemplate } from '@/types/prompt';
import { CreatePromptDialog } from './components/CreatePromptDialog';
import { DeletePromptDialog } from './components/DeletePromptDialog';
import { PromptListFilters } from './components/PromptListFilters';
import { PromptListTable } from './components/PromptListTable';
import { INITIAL_QUERY, usePromptList } from './hooks/usePromptList';

export function PromptListPage() {
  const router = useRouter();
  const { query, setQuery, data, loading, error, refresh, allTags } = usePromptList();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<PromptTemplate | null>(null);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

  const hasAnyFilter = useMemo(() => {
    return (
      Boolean(query.keyword?.trim()) ||
      (query.tags?.length ?? 0) > 0 ||
      query.status !== undefined
    );
  }, [query.keyword, query.status, query.tags]);

  function resetQuery() {
    setQuery({
      ...INITIAL_QUERY,
      keyword: undefined,
      tags: undefined,
      status: undefined,
    });
  }

  function openDelete(row: PromptTemplate) {
    setDeleteRow(row);
    setDeleteOpen(true);
  }

  function toEdit(id: string) {
    router.push(`/admin/prompts/${id}/edit`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-slate-900">Prompt 模板</div>
          <div className="text-sm text-slate-500">
            管理业务侧 LLM 提示词，无需发版即可热更
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          新建模板
        </Button>
      </div>

      <PromptListFilters
        query={query}
        allTags={allTags}
        onChange={setQuery}
        onReset={resetQuery}
      />

      {error && !loading ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-10 text-center">
          <div className="text-sm text-rose-700">加载失败</div>
          <div className="mt-4">
            <Button variant="outline" onClick={refresh}>
              重试
            </Button>
          </div>
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <FileText className="h-10 w-10 text-slate-400" />
            {hasAnyFilter ? (
              <>
                <div className="text-sm text-slate-700">没有符合条件的模板</div>
                <Button variant="ghost" onClick={resetQuery}>
                  清除筛选
                </Button>
              </>
            ) : (
              <>
                <div className="text-sm text-slate-700">还没有 Prompt 模板</div>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  新建第一个模板
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <PromptListTable
          rows={rows}
          loading={loading}
          onRowClick={toEdit}
          onEdit={toEdit}
          onDelete={openDelete}
        />
      )}

      {!loading && total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-sm text-slate-500">
            共 <span className="font-medium text-slate-900">{total}</span> 条 · 第{' '}
            {query.page}/{totalPages} 页
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={query.page <= 1}
              onClick={() => setQuery({ page: query.page - 1 })}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={query.page >= totalPages}
              onClick={() => setQuery({ page: query.page + 1 })}
            >
              下一页
            </Button>
          </div>
        </div>
      ) : null}

      <CreatePromptDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => toEdit(id)}
      />

      <DeletePromptDialog
        open={deleteOpen}
        row={deleteRow}
        onOpenChange={setDeleteOpen}
        onDeleted={() => {
          if (rows.length === 1 && query.page > 1) {
            setQuery({ page: query.page - 1 });
          } else {
            refresh();
          }
        }}
      />
    </div>
  );
}

