import { AgencyPageState, resolveAgencyPageState } from '@/components/agency/agency-page-state';

export default function AgencyOrdersPage({
  searchParams,
}: {
  searchParams?: { state?: string | string[] };
}) {
  const state = resolveAgencyPageState(searchParams?.state);

  return (
    <AgencyPageState
      title="代下单管理"
      state={state}
      emptyMessage="当前暂无代下单记录。"
      errorMessage="代下单列表加载失败。"
    >
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">代下单管理（骨架）</h1>
        <p className="text-sm text-slate-600">用于后续接入机构代下单创建、订单查询与来源标记能力。</p>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-slate-700">订单录入区（占位）</p>
          <p className="text-xs text-slate-500">计划支持学生信息、论文需求、紧急程度与备注提交。</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-slate-700">订单列表区（占位）</p>
          <p className="text-xs text-slate-500">计划展示订单状态、支付状态、任务进度、最近操作人。</p>
        </div>
      </section>
    </AgencyPageState>
  );
}
