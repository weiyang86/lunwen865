import { ClientPageState, resolveClientPageState } from '@/components/client/client-page-state';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const params = await searchParams;
  const state = resolveClientPageState(params.state);

  return (
    <ClientPageState
      title="订单页（骨架）"
      state={state}
      emptyMessage="暂无订单记录"
      errorMessage="订单页加载失败"
    >
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">订单页（骨架）</h1>
        <p className="text-sm text-slate-600">用于后续接入订单列表与订单详情。</p>
      </section>
    </ClientPageState>
  );
}
