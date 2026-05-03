'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';

const LABEL_MAP: Record<string, string> = {
  admin: '管理后台',
  users: '用户管理',
  orders: '订单管理',
  tasks: '任务管理',
  prompts: 'Prompt 模板',
  stores: '门店管理',
  products: '商品管理',
  categories: '分类管理',
  deployments: '部署中心',
  envs: '环境配置',
  new: '新建',
  edit: '编辑',
};

export function Breadcrumbs() {
  const pathname = usePathname() ?? '';

  const segments = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    return parts.map((seg, idx) => ({
      label: LABEL_MAP[seg] || seg,
      href: `/${parts.slice(0, idx + 1).join('/')}`,
      isLast: idx === parts.length - 1,
    }));
  }, [pathname]);

  return (
    <nav className="flex items-center gap-1 text-sm text-slate-500">
      {segments.map((s, i) => (
        <div key={s.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
          {s.isLast ? (
            <span className="font-medium text-slate-900">{s.label}</span>
          ) : (
            <Link href={s.href} className="hover:text-slate-900">
              {s.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
