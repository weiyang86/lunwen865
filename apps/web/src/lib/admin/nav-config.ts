import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  ClipboardList,
  Sparkles,
  Store,
  Package,
  School,
  WandSparkles,
  FileText,
  Rocket,
  Settings,
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
  {
    label: '任务管理',
    icon: ClipboardList,
    children: [
      { label: '任务管理（散客）', href: '/admin/tasks' },
      { label: '任务管理（机构）', href: '/admin/tasks/agency' },
    ],
  },
  { label: '后台参数设置', href: '/admin/settings', icon: Settings },
  { label: 'Prompt 模板', href: '/admin/prompts', icon: Sparkles },
  { label: '门店管理', href: '/admin/stores', icon: Store },
  { label: '商品管理', href: '/admin/products', icon: Package },
  {
    label: '学术基础数据',
    icon: School,
    children: [
      { label: '高校管理', href: '/admin/academic/schools' },
      { label: '学院管理', href: '/admin/academic/colleges' },
      { label: '专业管理', href: '/admin/academic/majors' },
      { label: '学科目录', href: '/admin/academic/disciplines' },
      { label: '学校专业关系', href: '/admin/academic/school-majors' },
      { label: '研究生专业', href: '/admin/academic/postgraduate-programs' },
      { label: '数据同步', href: '/admin/academic/sync' },
    ],
  },
  {
    label: '论文 Skill 中心',
    icon: WandSparkles,
    children: [
      { label: 'Skill 列表', href: '/admin/thesis-skills' },
      { label: '运行记录', href: '/admin/thesis-skills/runs' },
    ],
  },
  {
    label: '论文导出引擎',
    icon: FileText,
    children: [
      { label: '格式模板', href: '/admin/thesis-format-templates' },
      { label: '导出任务', href: '/admin/thesis-export-jobs' },
    ],
  },
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
