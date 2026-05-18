import Link from 'next/link';

const FEATURES: Array<{
  title: string;
  description: string;
}> = [
  {
    title: '全流程工作台',
    description: '题目 → 开题 → 大纲 → 正文 → 参考文献，一条线跑通，进度可视。',
  },
  {
    title: '支持导师意见修改',
    description: '按章节给反馈，一键重写/人工编辑，改稿更高效。',
  },
  {
    title: '导出 Word 交付',
    description: '正文带引用角标，附参考文献列表，便于提交与存档。',
  },
];

const STEPS: Array<{
  title: string;
  description: string;
}> = [
  { title: '创建任务', description: '填写专业与方向，生成候选题目，挑选最合适的。' },
  { title: '生成开题', description: '按结构输出开题报告，支持续传与单节重试。' },
  { title: '生成大纲', description: '目标字数可控，目录层级清晰，确认后再进入正文。' },
  { title: '生成正文', description: '按小节生成、失败可恢复、可定位问题，进度实时可见。' },
  { title: '参考文献', description: '支持篇数/年份/侧重点配置，并与正文引用联动。' },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: '我已经生成了正文，为什么有时后台还显示在大纲阶段？',
    a: '系统以“任务阶段 + 产物”综合判断。若已存在正文产物，任务会自动纠偏到正文阶段，刷新即可同步。',
  },
  {
    q: '可以只改某一章/某一节吗？',
    a: '可以。支持按章节提交导师意见重写，也支持人工编辑覆盖内容。',
  },
  {
    q: '导出的 Word 会包含参考文献吗？',
    a: '会。正文引用会以角标形式展示，并在文末附参考文献列表。',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 text-sm font-semibold text-white">
              通
            </span>
            <span className="text-base font-semibold tracking-tight">论文通</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <Link href="/products" className="hover:text-slate-900">
              服务
            </Link>
            <Link href="/tasks" className="hover:text-slate-900">
              任务
            </Link>
            <Link href="/downloads" className="hover:text-slate-900">
              下载
            </Link>
            <Link href="/admin/login" className="hover:text-slate-900">
              管理后台
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              登录
            </Link>
            <Link
              href="/products"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              立即开始
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-200/40 blur-3xl" />
            <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" />
            <div className="absolute -bottom-32 right-10 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
          </div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-700 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                毕业论文全流程工作台
              </div>

              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                论文通：从题目到正文，
                <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
                  一次搞定
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
                面向刚毕业/应届同学，流程清晰、进度可视、可恢复生成。支持导师意见修改与 Word
                导出，交付更稳、更省心。
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  选购服务包
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  登录后继续
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">进度条可视化</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">支持断点续写</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">章节级重试/改写</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">引用与参考文献联动</span>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-900">
                    任务工作区
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    正文生成成功
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>进度</span>
                    <span>100%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div className="h-2 w-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-medium text-slate-900">
                      导师意见改写
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-slate-600">
                      按章节提交修改意见，定位更精确，返工更快。
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-medium text-slate-900">
                      Word 导出交付
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-slate-600">
                      引用角标 + 参考文献列表，提交规范更省力。
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                提示：实际内容以你的任务数据为准，此处为示意卡片。
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <div className="flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">你关心的，论文通都考虑到了</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                刚毕业那段时间最宝贵的是时间与确定性。我们把交付流程拆到每个阶段，让你随时知道“下一步做什么”。
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="text-base font-semibold text-slate-900">
                  {f.title}
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600">
                  {f.description}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">论文交付流程，一眼看懂</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  从题目到正文，不需要“猜进度”。每一步都有可见结果与可恢复机制。
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {STEPS.map((s, idx) => (
                  <div
                    key={s.title}
                    className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-900 shadow-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {s.title}
                      </div>
                      <div className="mt-1 text-sm leading-relaxed text-slate-600">
                        {s.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">常见问题</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                把你可能卡住的地方提前说明清楚，避免反复试错。
              </p>
            </div>
            <div className="space-y-3">
              {FAQS.map((it) => (
                <details
                  key={it.q}
                  className="group rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                    <span className="inline-flex items-center justify-between gap-3">
                      {it.q}
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">
                        ▾
                      </span>
                    </span>
                  </summary>
                  <div className="mt-3 text-sm leading-relaxed text-slate-600">
                    {it.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-sky-600 p-10 text-white shadow-sm">
            <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  现在开始，让毕业更轻松一点
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/90">
                  论文通把复杂流程拆到每一步，你只需要按节奏推进：生成、修改、导出、提交。
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-white/90"
                >
                  去选购
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-transparent px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  登录
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/60 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
              通
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">论文通</div>
              <div className="text-xs text-slate-500">
                毕业论文一站式生成与交付平台
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
            <Link href="/products" className="hover:text-slate-900">
              服务
            </Link>
            <Link href="/tasks" className="hover:text-slate-900">
              任务
            </Link>
            <Link href="/downloads" className="hover:text-slate-900">
              下载
            </Link>
            <Link href="/admin/login" className="hover:text-slate-900">
              管理后台
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
