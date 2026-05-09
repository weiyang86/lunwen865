import { ClientPageState, resolveClientPageState } from '@/components/client/client-page-state';

export default async function DownloadsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const params = await searchParams;
  const state = resolveClientPageState(params.state);

  return (
    <ClientPageState
      title="下载中心（骨架）"
      state={state}
      emptyMessage="暂无下载文件"
      errorMessage="下载页加载失败"
    >
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">下载中心（骨架）</h1>
        <p className="text-sm text-slate-600">用于后续接入导出文件列表与下载记录。</p>
      </section>
    </ClientPageState>
  );
}
