import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  ClipboardList,
  Sparkles,
  Store,
  Package,
  Rocket,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  roles?: Array<'ADMIN' | 'SUPER_ADMIN'>;
  children?: Array<{ label: string; href: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { label: '仪表盘', href: '/admin', icon: LayoutDashboard },
  { label: '用户管理', href: '/admin/users', icon: Users },
  { label: '订单管理', href: '/admin/orders', icon: ShoppingBag },
  { label: '任务管理', href: '/admin/tasks', icon: ClipboardList },
  { label: 'Prompt 模板', href: '/admin/prompts', icon: Sparkles },
  { label: '门店管理', href: '/admin/stores', icon: Store },
  { label: '商品管理', href: '/admin/products', icon: Package },
  {
    label: '部署中心',
    icon: Rocket,
    roles: ['SUPER_ADMIN'],
    children: [
      { label: '部署记录', href: '/admin/deployments' },
      { label: '环境配置', href: '/admin/deployments/envs' },
    ],
  },
];
