export function AgencyPageLoading({ title }: { title: string }) {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="animate-pulse space-y-3">
        <div className="h-10 w-full rounded-md bg-slate-200" />
        <div className="h-24 w-full rounded-md bg-slate-200" />
        <div className="h-24 w-full rounded-md bg-slate-200" />
      </div>
      <p className="text-sm text-slate-500">正在加载机构数据...</p>
    </section>
  );
}
