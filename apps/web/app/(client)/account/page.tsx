import { ClientPageState, resolveClientPageState } from '@/components/client/client-page-state';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const params = await searchParams;
  const state = resolveClientPageState(params.state);

  return (
    <ClientPageState
      title="账户中心（骨架）"
      state={state}
      emptyMessage="暂无账户信息"
      errorMessage="账户页加载失败"
    >
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">账户中心（骨架）</h1>
        <p className="text-sm text-slate-600">用于后续接入个人资料、绑定信息和安全设置。</p>
      </section>
    </ClientPageState>
  );
}
