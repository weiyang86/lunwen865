export function ClientPageEmpty({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-white p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-slate-600">{message}</p>
      <p className="text-xs text-slate-400">暂无数据，可稍后重试。</p>
    </section>
  );
}
