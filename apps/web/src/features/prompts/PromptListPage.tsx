'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PromptTemplate } from '@/types/prompt';
import { CreatePromptDialog } from './components/CreatePromptDialog';
import { DeletePromptDialog } from './components/DeletePromptDialog';
import { PromptListFilters } from './components/PromptListFilters';
import { PromptListTable } from './components/PromptListTable';
import { INITIAL_QUERY, usePromptList } from './hooks/usePromptList';

export function PromptListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { query, setQuery, data, loading, error, refresh, allTags } = usePromptList();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<PromptTemplate | null>(null);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [prefillExample, setPrefillExample] = useState(false);

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

  useEffect(() => {
    if (!searchParams) return;
    const create = searchParams.get('create');
    if (create !== '1') return;
    const example = searchParams.get('example') === '1';
    setPrefillExample(example);
    setCreateOpen(true);
    router.replace('/admin/prompts');
  }, [router, searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-slate-900">Prompt 模板</div>
          <div className="text-sm text-slate-500">
            管理业务侧 LLM 提示词，无需发版即可热更
          </div>
        </div>
        <Button
          onClick={() => {
            setPrefillExample(false);
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          新建模板
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>新增示例</CardTitle>
            <CardDescription>
              给客户一个可复制的模板案例，避免新增时不知道怎么写
            </CardDescription>
          </div>
          <Button variant="secondary" onClick={() => setExampleOpen((v) => !v)}>
            {exampleOpen ? '收起' : '展开'}
          </Button>
        </CardHeader>
        {exampleOpen ? (
          <CardContent>
            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <span className="font-medium">sceneKey：</span>
                <span className="ml-2 font-mono">paper.abstract.generate</span>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Prompt 内容示例（变量用 {'{{变量名}}'} 引用）</div>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-slate-800">
{`你是一名中文学术论文写作助手，请基于输入信息生成【中文摘要】与【英文摘要】。

【论文标题】{{title}}
【研究方向】{{topic}}
【目标字数】{{wordCount}}
【关键词】{{keywords}}

要求：
1) 中文摘要与英文摘要各一段，结构清晰，避免口语化。
2) 不要输出除摘要与关键词之外的任何内容。
3) 若信息不足，请合理补全但不要编造具体数据来源。`}
                </pre>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">变量配置示例（与 Prompt 里的变量名一致）</div>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-slate-800">
{`[
  { "name": "title", "label": "论文标题", "type": "text", "required": true },
  { "name": "topic", "label": "研究方向", "type": "textarea", "required": true },
  { "name": "wordCount", "label": "目标字数", "type": "number", "required": true },
  { "name": "keywords", "label": "关键词", "type": "text", "required": false }
]`}
                </pre>
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>

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
                <Button
                  onClick={() => {
                    setPrefillExample(false);
                    setCreateOpen(true);
                  }}
                >
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
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) setPrefillExample(false);
        }}
        onCreated={(id) => {
          refresh();
          toEdit(id);
        }}
        prefillExample={prefillExample}
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
