'use client';

import { ArrowLeft, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePromptDetail } from './hooks/usePromptDetail';

export function PromptEditPage({ id }: { id: string }) {
  const router = useRouter();
  const { data, loading, error, refresh } = usePromptDetail(id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/admin/prompts')}>
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : error || !data ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-10 text-center">
          <div className="text-sm text-rose-700">模板不存在或已被删除</div>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={() => router.push('/admin/prompts')}>
              返回列表
            </Button>
            <Button variant="outline" onClick={refresh}>
              重试
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-900">{data.name}</div>
                <div className="mt-1 font-mono text-xs text-slate-500">{data.sceneKey}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-slate-600" />
              编辑器加载中（7A-2）
            </div>
            <div className="mt-2 text-sm text-slate-600">
              该模板的内容编辑、变量配置、模型参数、草稿自动保存等功能将在 7A-2 中实现。
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 p-3">
                <div className="text-xs text-slate-500">模板 ID</div>
                <div className="mt-1 font-mono text-xs text-slate-900">{data.id}</div>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <div className="text-xs text-slate-500">当前版本</div>
                <div className="mt-1 text-sm text-slate-900">
                  {data.currentVersionNo ?? '未发布'}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <div className="text-xs text-slate-500">草稿状态</div>
                <div className="mt-1 text-sm text-slate-900">
                  {data.draft ? '存在' : '无'}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <div className="text-xs text-slate-500">状态</div>
                <div className="mt-1 text-sm text-slate-900">
                  {data.status === 'ENABLED' ? '启用' : '禁用'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

