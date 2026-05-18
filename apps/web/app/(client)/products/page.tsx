'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { ClientPageState } from '@/components/client/client-page-state';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { clientHttp } from '@/lib/client/api-client';
import { addToCart } from '@/lib/client/cart';
import { formatYuanFromFen } from '@/utils/format';

type ApiProduct = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  priceCents: number;
  originalPriceCents: number | null;
  brainCellAmount: number;
  paperQuota: number;
  polishQuota: number;
  exportQuota: number;
  aiChatQuota: number;
  status: string;
  sortOrder: number;
  totalStock: number;
  soldCount: number;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
};

function sanitizeRichTextHtml(input: string): string {
  const html = input || '';
  const removedDangerous = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi,
      '',
    );

  const allowed = new Set([
    'p',
    'br',
    'b',
    'strong',
    'i',
    'em',
    'u',
    'ul',
    'ol',
    'li',
    'a',
    'span',
  ]);

  return removedDangerous.replace(
    /<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g,
    (raw, tagNameRaw: string, attrsRaw: string | undefined) => {
      const tagName = tagNameRaw.toLowerCase();
      const isClosing = raw.startsWith('</');
      if (!allowed.has(tagName)) return '';
      if (isClosing) return `</${tagName}>`;

      if (tagName === 'a') {
        const attrs = attrsRaw || '';
        const hrefMatch = attrs.match(
          /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i,
        );
        const href = hrefMatch
          ? (hrefMatch[2] || hrefMatch[3] || hrefMatch[4] || '').trim()
          : '';
        const safeHref =
          href.startsWith('http://') || href.startsWith('https://') ? href : '';
        if (safeHref) {
          return `<a href="${safeHref}" target="_blank" rel="noreferrer">`;
        }
        return '<a>';
      }

      return `<${tagName}>`;
    },
  );
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const list = await clientHttp.get<ApiProduct[]>('/products');
        if (!mounted) return;
        setProducts(Array.isArray(list) ? list : []);
      } catch (e: unknown) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return products.find((p) => p.id === selectedId) ?? null;
  }, [products, selectedId]);

  const state = loading
    ? 'loading'
    : error
      ? 'error'
      : products.length === 0
        ? 'empty'
        : 'success';

  return (
    <ClientPageState
      title="商品"
      state={state}
      emptyMessage="暂无商品数据"
      errorMessage="商品页加载失败"
    >
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">商品</h1>
            <p className="mt-1 text-sm text-slate-600">
              选择合适的服务包，开启论文通的全流程交付。
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const safeHtml = sanitizeRichTextHtml(p.description || '');
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm hover:border-slate-300"
              >
                <div className="h-40 w-full bg-slate-100">
                  {p.coverUrl ? (
                    <img
                      src={p.coverUrl}
                      alt={p.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>

                <div className="space-y-3 p-5">
                  <div>
                    <div className="text-base font-semibold text-slate-900">
                      {p.name}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <div className="text-lg font-semibold text-slate-900">
                        {formatYuanFromFen(p.priceCents)}
                      </div>
                      {p.originalPriceCents ? (
                        <div className="text-sm text-slate-400 line-through">
                          {formatYuanFromFen(p.originalPriceCents)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {safeHtml ? (
                    <div
                      className="max-h-20 overflow-hidden text-sm leading-relaxed text-slate-600 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 last:[&_p]:mb-0"
                      dangerouslySetInnerHTML={{ __html: safeHtml }}
                    />
                  ) : (
                    <div className="text-sm text-slate-500">暂无简介</div>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    {p.brainCellAmount ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        购买获得 脑细胞 {p.brainCellAmount}
                      </span>
                    ) : (
                      <>
                        {p.paperQuota ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            论文生成 {p.paperQuota} 次
                          </span>
                        ) : null}
                        {p.exportQuota ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            导出 {p.exportQuota} 次
                          </span>
                        ) : null}
                        {p.aiChatQuota ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            AI 对话 {p.aiChatQuota} 次
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(v) => {
          if (!v) setSelectedId(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>商品详情</DialogTitle>
          </DialogHeader>

          {selected ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {selected.coverUrl ? (
                  <img
                    src={selected.coverUrl}
                    alt={selected.name}
                    className="h-64 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                    暂无缩略图
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-xl font-semibold text-slate-900">
                  {selected.name}
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-semibold text-slate-900">
                    {formatYuanFromFen(selected.priceCents)}
                  </div>
                  {selected.originalPriceCents ? (
                    <div className="text-sm text-slate-400 line-through">
                      {formatYuanFromFen(selected.originalPriceCents)}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  {selected.brainCellAmount ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      购买获得 脑细胞 {selected.brainCellAmount}
                    </span>
                  ) : (
                    <>
                      {selected.paperQuota ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          论文生成 {selected.paperQuota} 次
                        </span>
                      ) : null}
                      {selected.polishQuota ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          润色 {selected.polishQuota} 次
                        </span>
                      ) : null}
                      {selected.exportQuota ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          导出 {selected.exportQuota} 次
                        </span>
                      ) : null}
                      {selected.aiChatQuota ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          AI 对话 {selected.aiChatQuota} 次
                        </span>
                      ) : null}
                    </>
                  )}
                </div>

                {selected.description ? (
                  <div
                    className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 last:[&_p]:mb-0"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichTextHtml(selected.description),
                    }}
                  />
                ) : (
                  <div className="text-sm text-slate-500">暂无简介</div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                if (!selected) return;
                if (adding) return;
                setAdding(true);
                try {
                  addToCart(
                    {
                      productId: selected.id,
                      name: selected.name,
                      coverUrl: selected.coverUrl,
                      priceCents: selected.priceCents,
                      originalPriceCents: selected.originalPriceCents,
                    },
                    1,
                  );
                  toast.success('已加入购物车');
                } finally {
                  setAdding(false);
                }
              }}
              disabled={!selected || adding}
            >
              {adding ? '加入中...' : '加入购物车'}
            </Button>
            <Button
              onClick={() => {
                if (!selected) return;
                if (buying) return;
                setBuying(true);
                void (async () => {
                  try {
                    await clientHttp.post('/orders', { productId: selected.id });
                    toast.success('已创建订单');
                    setSelectedId(null);
                    router.push('/orders');
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : '下单失败');
                  } finally {
                    setBuying(false);
                  }
                })();
              }}
              disabled={!selected || buying}
            >
              {buying ? '下单中...' : '立即购买'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientPageState>
  );
}
