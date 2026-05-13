export function AgencyPageEmpty(props: { title: string; message: string }) {
  const { title, message } = props;

  return (
    <section className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-white p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-slate-600">{message}</p>
      <p className="text-xs text-slate-400">暂无可展示内容，请稍后重试或调整筛选条件。</p>
    </section>
  );
}
