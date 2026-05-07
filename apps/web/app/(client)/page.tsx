import { ClientPageState, resolveClientPageState } from '@/components/client/client-page-state';

export default async function ClientHomePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const params = await searchParams;
  const state = resolveClientPageState(params.state);

  return (
    <ClientPageState
      title="学生端首页（骨架）"
      state={state}
      emptyMessage="暂无首页内容"
      errorMessage="首页加载失败"
    >
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">学生端首页（骨架）</h1>
        <p className="text-sm text-slate-600">
          当前为 P0-1A/P0-1B 路由与状态骨架，用于承接后续商品下单、任务进度与下载等功能。
        </p>
      </section>
    </ClientPageState>
  );
}
