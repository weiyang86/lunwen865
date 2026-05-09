import { ClientPageState, resolveClientPageState } from '@/components/client/client-page-state';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const params = await searchParams;
  const state = resolveClientPageState(params.state);

  return (
    <ClientPageState
      title="商品页（骨架）"
      state={state}
      emptyMessage="暂无商品数据"
      errorMessage="商品页加载失败"
    >
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">商品页（骨架）</h1>
        <p className="text-sm text-slate-600">用于后续接入商品列表、详情与购买流程。</p>
      </section>
    </ClientPageState>
  );
}
