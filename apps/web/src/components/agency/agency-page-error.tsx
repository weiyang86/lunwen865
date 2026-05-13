export function AgencyPageError(props: { title: string; message: string }) {
  const { title, message } = props;

  return (
    <section className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm">{message}</p>
      <p className="text-xs text-red-500">请求失败，请刷新后重试或联系运营管理员。</p>
    </section>
  );
}
