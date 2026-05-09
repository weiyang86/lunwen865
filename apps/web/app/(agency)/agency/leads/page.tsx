import { AgencyPageState, resolveAgencyPageState } from '@/components/agency/agency-page-state';

export default function AgencyLeadsPage({
  searchParams,
}: {
  searchParams?: { state?: string | string[] };
}) {
  const state = resolveAgencyPageState(searchParams?.state);

  return (
    <AgencyPageState
      title="线索管理"
      state={state}
      emptyMessage="当前暂无待跟进线索。"
      errorMessage="线索列表加载失败。"
    >
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">线索管理（骨架）</h1>
        <p className="text-sm text-slate-600">用于后续接入机构推单线索创建、筛选与详情跟进流程。</p>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-slate-700">线索筛选区（占位）</p>
          <p className="text-xs text-slate-500">计划支持姓名、专业、阶段、意向时间等筛选条件。</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-slate-700">线索列表区（占位）</p>
          <p className="text-xs text-slate-500">计划展示线索来源、跟进状态、负责人、最近更新时间。</p>
        </div>
      </section>
    </AgencyPageState>
  );
}
