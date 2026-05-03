'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, MoreHorizontal } from 'lucide-react';

import { UsersPagination } from '@/components/admin/users/users-pagination';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchUsers } from '@/services/admin/users';
import {
  batchAssignAdminTasks,
  batchOverrideAdminTasksStatus,
  batchUnlinkAdminTasksOrders,
  exportAdminTasksCsv,
  listAdminTasks,
  type AdminTaskListItem,
  type BackendTaskStatus,
} from '@/services/admin/tasks';
import { StageBadge } from '@/components/order/StageBadge';
import { formatDateTime } from '@/utils/format';
import { TaskStatusBadge } from '@/components/admin/tasks/task-status-badge';
import { TaskDetailDrawer } from '@/components/admin/tasks/task-detail-drawer';

type PageState = {
  page: number;
  pageSize: number;
};

type Filters = {
  search: string;
  orderNo: string;
  statuses: BackendTaskStatus[];
  createdAtStart: string;
  createdAtEnd: string;
  linkedOnly: boolean;
  sortBy: 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
};

const STATUS_OPTIONS: Array<{ value: BackendTaskStatus; label: string }> = [
  { value: 'INIT', label: '待开始' },
  { value: 'TOPIC_GENERATING', label: '题目生成中' },
  { value: 'TOPIC_PENDING_REVIEW', label: '题目待审核' },
  { value: 'TOPIC_APPROVED', label: '题目已通过' },
  { value: 'OPENING_GENERATING', label: '开题生成中' },
  { value: 'OPENING_PENDING_REVIEW', label: '开题待审核' },
  { value: 'OPENING_APPROVED', label: '开题已通过' },
  { value: 'OUTLINE_GENERATING', label: '大纲生成中' },
  { value: 'OUTLINE_PENDING_REVIEW', label: '大纲待审核' },
  { value: 'OUTLINE_APPROVED', label: '大纲已通过' },
  { value: 'WRITING', label: '写作中' },
  { value: 'WRITING_PAUSED', label: '写作暂停' },
  { value: 'MERGING', label: '合稿中' },
  { value: 'FORMATTING', label: '排版中' },
  { value: 'REVIEW', label: '审核中' },
  { value: 'REVISION', label: '修改中' },
  { value: 'DONE', label: '已完成' },
  { value: 'FAILED', label: '失败' },
  { value: 'CANCELLED', label: '已取消' },
];

function parseStatuses(values: string[]): BackendTaskStatus[] {
  const allowed = new Set(STATUS_OPTIONS.map((s) => s.value));
  return values.filter((v) => allowed.has(v as any)) as BackendTaskStatus[];
}

function buildQueryString(args: {
  base: { toString(): string };
  patch: Partial<{
    id: string | null;
    action: 'assign' | 'override' | 'note' | null;
    page: number;
    pageSize: number;
    search: string;
    orderNo: string;
    statuses: BackendTaskStatus[];
    createdAtStart: string;
    createdAtEnd: string;
    linkedOnly: boolean;
    sortBy: 'createdAt' | 'updatedAt';
    sortOrder: 'asc' | 'desc';
  }>;
}): string {
  const sp = new URLSearchParams(args.base.toString());

  if ('id' in args.patch) {
    const v = args.patch.id;
    if (v) sp.set('id', v);
    else sp.delete('id');
  }

  if ('action' in args.patch) {
    const v = args.patch.action;
    if (v) sp.set('action', v);
    else sp.delete('action');
  }

  if ('page' in args.patch) sp.set('page', String(args.patch.page ?? 1));
  if ('pageSize' in args.patch) sp.set('pageSize', String(args.patch.pageSize ?? 20));

  if ('search' in args.patch) {
    const v = (args.patch.search ?? '').trim();
    if (v) sp.set('q', v);
    else sp.delete('q');
  }

  if ('orderNo' in args.patch) {
    const v = (args.patch.orderNo ?? '').trim();
    if (v) sp.set('orderNo', v);
    else sp.delete('orderNo');
  }

  if ('createdAtStart' in args.patch) {
    const v = (args.patch.createdAtStart ?? '').trim();
    if (v) sp.set('createdAtStart', v);
    else sp.delete('createdAtStart');
  }

  if ('createdAtEnd' in args.patch) {
    const v = (args.patch.createdAtEnd ?? '').trim();
    if (v) sp.set('createdAtEnd', v);
    else sp.delete('createdAtEnd');
  }

  if ('linkedOnly' in args.patch) {
    if (args.patch.linkedOnly) sp.set('linked', '1');
    else sp.delete('linked');
  }

  if ('sortBy' in args.patch) sp.set('sortBy', args.patch.sortBy ?? 'createdAt');
  if ('sortOrder' in args.patch) sp.set('sortOrder', args.patch.sortOrder ?? 'desc');

  if ('statuses' in args.patch) {
    sp.delete('status');
    for (const s of args.patch.statuses ?? []) sp.append('status', s);
  }

  return sp.toString();
}

export default function AdminTasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = searchParams ?? (new URLSearchParams() as any);
  const spString = sp.toString();

  const [pageState, setPageState] = useState<PageState>({ page: 1, pageSize: 20 });
  const [filters, setFilters] = useState<Filters>({
    search: '',
    orderNo: '',
    statuses: [],
    createdAtStart: '',
    createdAtEnd: '',
    linkedOnly: false,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const [draft, setDraft] = useState<Filters>(filters);

  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAction, setDrawerAction] = useState<'assign' | 'override' | 'note' | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchAssignOpen, setBatchAssignOpen] = useState(false);
  const [batchOverrideOpen, setBatchOverrideOpen] = useState(false);
  const [batchUnlinkOpen, setBatchUnlinkOpen] = useState(false);
  const [batchConfirmOverrideOpen, setBatchConfirmOverrideOpen] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);

  const [assigneeKeyword, setAssigneeKeyword] = useState('');
  const [assigneeResults, setAssigneeResults] = useState<any[]>([]);
  const [assigneeIdInput, setAssigneeIdInput] = useState('');
  const [assigneeLoading, setAssigneeLoading] = useState(false);

  const [overrideTarget, setOverrideTarget] = useState<BackendTaskStatus>('INIT');
  const [overrideReason, setOverrideReason] = useState('');

  const [exporting, setExporting] = useState(false);

  const [items, setItems] = useState<AdminTaskListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    const sp2 = new URLSearchParams(spString);
    const q = sp2.get('q') ?? '';
    const orderNo = sp2.get('orderNo') ?? '';
    const createdAtStart = sp2.get('createdAtStart') ?? '';
    const createdAtEnd = sp2.get('createdAtEnd') ?? '';
    const linkedOnly = sp2.get('linked') === '1';
    const sortBy =
      (sp2.get('sortBy') as any) === 'updatedAt' ? 'updatedAt' : 'createdAt';
    const sortOrder =
      (sp2.get('sortOrder') as any) === 'asc' ? 'asc' : 'desc';
    const statuses = parseStatuses(sp2.getAll('status'));
    const page = Math.max(1, Number(sp2.get('page') ?? 1) || 1);
    const pageSize = Math.max(1, Number(sp2.get('pageSize') ?? 20) || 20);
    const id = sp2.get('id');
    const actionParam = sp2.get('action');
    const action =
      actionParam === 'assign' || actionParam === 'override' || actionParam === 'note'
        ? (actionParam as any)
        : null;

    setFilters({
      search: q,
      orderNo,
      statuses,
      createdAtStart,
      createdAtEnd,
      linkedOnly,
      sortBy,
      sortOrder,
    });
    setDraft({
      search: q,
      orderNo,
      statuses,
      createdAtStart,
      createdAtEnd,
      linkedOnly,
      sortBy,
      sortOrder,
    });
    setPageState({ page, pageSize });
    setDrawerAction(action);

    if (id) {
      setDrawerTaskId(id);
      setDrawerOpen(true);
    } else {
      setDrawerOpen(false);
      setTimeout(() => setDrawerTaskId(null), 350);
    }
  }, [spString]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listAdminTasks({
      page: pageState.page,
      pageSize: pageState.pageSize,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      search: filters.search.trim() ? filters.search.trim() : undefined,
      orderNo: filters.orderNo.trim() ? filters.orderNo.trim() : undefined,
      statuses: filters.statuses.length ? filters.statuses : undefined,
      createdAtStart: filters.createdAtStart || undefined,
      createdAtEnd: filters.createdAtEnd || undefined,
      linkedOnly: filters.linkedOnly || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items ?? []);
        setTotal(Number(res.total ?? 0));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          (e && typeof e === 'object' && 'message' in e
            ? String((e as any).message)
            : null) || '加载任务失败';
        toast.error(msg);
        setItems([]);
        setTotal(0);
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pageState.page, pageState.pageSize, filters]);

  const selectedStatusLabels = useMemo(() => {
    if (draft.statuses.length === 0) return '全部状态';
    const map = new Map(STATUS_OPTIONS.map((o) => [o.value, o.label]));
    const labels = draft.statuses.map((s) => map.get(s) ?? s);
    if (labels.length <= 2) return labels.join('、');
    return `${labels.slice(0, 2).join('、')} 等 ${labels.length} 项`;
  }, [draft.statuses]);

  const pageIds = useMemo(() => items.map((x) => x.id), [items]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelectedOnPage = useMemo(() => {
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => selectedSet.has(id));
  }, [pageIds, selectedSet]);

  useEffect(() => {
    setSelectedIds([]);
  }, [filters, pageState.page, pageState.pageSize]);

  async function loadAssignees() {
    setAssigneeLoading(true);
    try {
      const res = await fetchUsers({
        page: 1,
        pageSize: 20,
        keyword: assigneeKeyword.trim() || undefined,
      });
      setAssigneeResults(res.items ?? []);
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '加载用户失败';
      toast.error(msg);
      setAssigneeResults([]);
    } finally {
      setAssigneeLoading(false);
    }
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) {
        if (!set.has(id) && set.size >= 200) {
          toast.error('批量操作最多支持 200 条');
          return prev;
        }
        set.add(id);
      } else {
        set.delete(id);
      }
      return Array.from(set);
    });
  }

  function toggleSelectAllOnPage(checked: boolean) {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (!checked) {
        for (const id of pageIds) set.delete(id);
        return Array.from(set);
      }
      for (const id of pageIds) {
        if (!set.has(id) && set.size >= 200) {
          toast.error('批量操作最多支持 200 条');
          break;
        }
        set.add(id);
      }
      return Array.from(set);
    });
  }

  async function doBatchAssign(assigneeId: string) {
    const ids = selectedIds;
    const v = assigneeId.trim();
    if (!v) return;
    if (ids.length === 0) return;
    setBatchSaving(true);
    try {
      await batchAssignAdminTasks({ ids, assigneeId: v });
      toast.success(`已指派 ${ids.length} 条任务`);
      setBatchAssignOpen(false);
      setSelectedIds([]);
      await listAdminTasks({
        page: pageState.page,
        pageSize: pageState.pageSize,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        search: filters.search.trim() ? filters.search.trim() : undefined,
        orderNo: filters.orderNo.trim() ? filters.orderNo.trim() : undefined,
        statuses: filters.statuses.length ? filters.statuses : undefined,
        createdAtStart: filters.createdAtStart || undefined,
        createdAtEnd: filters.createdAtEnd || undefined,
        linkedOnly: filters.linkedOnly || undefined,
      }).then((res) => {
        setItems(res.items ?? []);
        setTotal(Number(res.total ?? 0));
      });
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '批量指派失败';
      toast.error(msg);
    } finally {
      setBatchSaving(false);
    }
  }

  async function doBatchOverride() {
    const ids = selectedIds;
    if (ids.length === 0) return;
    if (!overrideReason.trim()) return;
    setBatchSaving(true);
    try {
      await batchOverrideAdminTasksStatus({
        ids,
        targetStatus: overrideTarget,
        reason: overrideReason,
      });
      toast.success(`已覆写 ${ids.length} 条任务`);
      setBatchConfirmOverrideOpen(false);
      setBatchOverrideOpen(false);
      setSelectedIds([]);
      await listAdminTasks({
        page: pageState.page,
        pageSize: pageState.pageSize,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        search: filters.search.trim() ? filters.search.trim() : undefined,
        orderNo: filters.orderNo.trim() ? filters.orderNo.trim() : undefined,
        statuses: filters.statuses.length ? filters.statuses : undefined,
        createdAtStart: filters.createdAtStart || undefined,
        createdAtEnd: filters.createdAtEnd || undefined,
        linkedOnly: filters.linkedOnly || undefined,
      }).then((res) => {
        setItems(res.items ?? []);
        setTotal(Number(res.total ?? 0));
      });
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '批量覆写失败';
      toast.error(msg);
    } finally {
      setBatchSaving(false);
    }
  }

  async function doBatchUnlinkOrders() {
    const ids = selectedIds;
    if (ids.length === 0) return;
    setBatchSaving(true);
    try {
      const res = await batchUnlinkAdminTasksOrders({ ids });
      toast.success(`已解除关联订单 ${Number((res as any).affectedOrders ?? 0)} 条`);
      setBatchUnlinkOpen(false);
      setSelectedIds([]);
      await listAdminTasks({
        page: pageState.page,
        pageSize: pageState.pageSize,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        search: filters.search.trim() ? filters.search.trim() : undefined,
        orderNo: filters.orderNo.trim() ? filters.orderNo.trim() : undefined,
        statuses: filters.statuses.length ? filters.statuses : undefined,
        createdAtStart: filters.createdAtStart || undefined,
        createdAtEnd: filters.createdAtEnd || undefined,
        linkedOnly: filters.linkedOnly || undefined,
      }).then((res2) => {
        setItems(res2.items ?? []);
        setTotal(Number(res2.total ?? 0));
      });
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '批量解除失败';
      toast.error(msg);
    } finally {
      setBatchSaving(false);
    }
  }

  async function doExportCsv() {
    setExporting(true);
    try {
      const { blob, filename } = await exportAdminTasksCsv({
        page: undefined,
        pageSize: undefined,
        limit: undefined,
        cursor: undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        search: filters.search.trim() ? filters.search.trim() : undefined,
        orderNo: filters.orderNo.trim() ? filters.orderNo.trim() : undefined,
        statuses: filters.statuses.length ? filters.statuses : undefined,
        createdAtStart: filters.createdAtStart || undefined,
        createdAtEnd: filters.createdAtEnd || undefined,
        linkedOnly: filters.linkedOnly || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('已开始导出');
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '导出失败';
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">任务管理</h1>
          <p className="text-sm text-slate-500">查看所有论文任务（只读）</p>
        </div>
        <div className="h-9" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">关键词</div>
              <input
                value={draft.search}
                onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                placeholder="标题 / 任务ID / 订单号"
                className={cn(
                  'h-9 w-72 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none',
                  'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                )}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-500">状态</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex h-9 w-56 items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700',
                      'hover:bg-slate-50',
                    )}
                  >
                    <span className="truncate">{selectedStatusLabels}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuLabel>选择状态（可多选）</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {STATUS_OPTIONS.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s.value}
                      checked={draft.statuses.includes(s.value)}
                      onCheckedChange={(checked) => {
                        setDraft((d) => {
                          const set = new Set(d.statuses);
                          if (checked) set.add(s.value);
                          else set.delete(s.value);
                          return { ...d, statuses: Array.from(set) };
                        });
                      }}
                    >
                      {s.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-500">创建时间</div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={draft.createdAtStart}
                  onChange={(e) => setDraft((d) => ({ ...d, createdAtStart: e.target.value }))}
                  className={cn(
                    'h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none',
                    'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                  )}
                />
                <span className="text-slate-400">~</span>
                <input
                  type="date"
                  value={draft.createdAtEnd}
                  onChange={(e) => setDraft((d) => ({ ...d, createdAtEnd: e.target.value }))}
                  className={cn(
                    'h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none',
                    'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                  )}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-500">关联订单号</div>
              <input
                value={draft.orderNo}
                onChange={(e) => setDraft((d) => ({ ...d, orderNo: e.target.value }))}
                placeholder="订单号（模糊匹配）"
                className={cn(
                  'h-9 w-52 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none',
                  'focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
                )}
              />
            </div>

            <label className="flex select-none items-center gap-2 pb-1 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.linkedOnly}
                onChange={(e) => setDraft((d) => ({ ...d, linkedOnly: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
              />
              仅显示已关联订单
            </label>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const qs = buildQueryString({
                    base: sp,
                    patch: {
                      id: sp.get('id'),
                      page: 1,
                      pageSize: pageState.pageSize,
                      search: '',
                      orderNo: '',
                      statuses: [],
                      createdAtStart: '',
                      createdAtEnd: '',
                      linkedOnly: false,
                      sortBy: 'createdAt',
                      sortOrder: 'desc',
                    },
                  });
                  router.replace(`/admin/tasks${qs ? `?${qs}` : ''}`);
                }}
              >
                重置
              </Button>
              <Button
                variant="outline"
                onClick={doExportCsv}
                disabled={exporting}
              >
                导出 CSV
              </Button>
              <Button
                onClick={() => {
                  const qs = buildQueryString({
                    base: sp,
                    patch: {
                      id: sp.get('id'),
                      page: 1,
                      pageSize: pageState.pageSize,
                      search: draft.search,
                      orderNo: draft.orderNo,
                      statuses: draft.statuses,
                      createdAtStart: draft.createdAtStart,
                      createdAtEnd: draft.createdAtEnd,
                      linkedOnly: draft.linkedOnly,
                      sortBy: draft.sortBy,
                      sortOrder: draft.sortOrder,
                    },
                  });
                  router.replace(`/admin/tasks${qs ? `?${qs}` : ''}`);
                }}
              >
                应用
              </Button>
            </div>
          </div>
        </div>

        {selectedIds.length > 0 ? (
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm text-slate-700">
                已选 {selectedIds.length} 条
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchAssignOpen(true)}
                disabled={batchSaving}
              >
                批量指派
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchOverrideOpen(true)}
                disabled={batchSaving}
              >
                批量覆写状态
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchUnlinkOpen(true)}
                disabled={batchSaving}
              >
                批量解除关联订单
              </Button>
              <div className="ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                  disabled={batchSaving}
                >
                  清空选择
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="p-4">
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
            <div className="mt-3">
              <Button
                variant="outline"
                onClick={() => {
                  const qs = buildQueryString({
                    base: sp,
                    patch: {
                      page: 1,
                      pageSize: pageState.pageSize,
                      search: filters.search,
                      orderNo: filters.orderNo,
                      statuses: filters.statuses,
                      createdAtStart: filters.createdAtStart,
                      createdAtEnd: filters.createdAtEnd,
                      linkedOnly: filters.linkedOnly,
                      sortBy: filters.sortBy,
                      sortOrder: filters.sortOrder,
                    },
                  });
                  router.replace(`/admin/tasks${qs ? `?${qs}` : ''}`);
                }}
                disabled={loading}
              >
                重试
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white">
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                    />
                  </TableHead>
                  <TableHead className="w-64">任务编号</TableHead>
                  <TableHead className="min-w-72">标题 / 类型</TableHead>
                  <TableHead className="w-44">状态</TableHead>
                  <TableHead className="w-44">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left text-slate-700 hover:text-slate-900"
                      onClick={() => {
                        const nextSortOrder =
                          filters.sortBy === 'createdAt'
                            ? filters.sortOrder === 'desc'
                              ? 'asc'
                              : 'desc'
                            : 'desc';
                        const qs = buildQueryString({
                          base: sp,
                          patch: { page: 1, sortBy: 'createdAt', sortOrder: nextSortOrder },
                        });
                        router.replace(`/admin/tasks${qs ? `?${qs}` : ''}`);
                      }}
                    >
                      创建时间
                      {filters.sortBy === 'createdAt' ? (filters.sortOrder === 'desc' ? '↓' : '↑') : ''}
                    </button>
                  </TableHead>
                  <TableHead className="w-44">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left text-slate-700 hover:text-slate-900"
                      onClick={() => {
                        const nextSortOrder =
                          filters.sortBy === 'updatedAt'
                            ? filters.sortOrder === 'desc'
                              ? 'asc'
                              : 'desc'
                            : 'desc';
                        const qs = buildQueryString({
                          base: sp,
                          patch: { page: 1, sortBy: 'updatedAt', sortOrder: nextSortOrder },
                        });
                        router.replace(`/admin/tasks${qs ? `?${qs}` : ''}`);
                      }}
                    >
                      更新时间
                      {filters.sortBy === 'updatedAt' ? (filters.sortOrder === 'desc' ? '↓' : '↑') : ''}
                    </button>
                  </TableHead>
                  <TableHead className="w-28 text-right">关联订单数</TableHead>
                  <TableHead className="w-20 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-14 text-center">
                      <div className="text-sm text-muted-foreground">暂无任务</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => {
                        const qs = buildQueryString({
                          base: sp,
                          patch: { id: t.id, action: null },
                        });
                        router.replace(`/admin/tasks${qs ? `?${qs}` : ''}`);
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(t.id)}
                          onChange={(e) => toggleSelected(t.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-900">
                        {t.id}
                      </TableCell>
                      <TableCell className="min-w-72">
                        <div className="space-y-1">
                          <div className="truncate text-sm text-slate-900">
                            {t.title || '—'}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{t.educationLevel}</span>
                            <StageBadge stage={t.currentStage as any} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TaskStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {formatDateTime(t.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {formatDateTime(t.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-400">
                        {t.isLinked ? 1 : 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4 text-slate-600" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>任务操作</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                              checked={false}
                              onSelect={(e) => {
                                e.preventDefault();
                                const qs = buildQueryString({
                                  base: sp,
                                  patch: { id: t.id, action: 'assign' },
                                });
                                router.replace(`/admin/tasks${qs ? `?${qs}` : ''}`);
                              }}
                            >
                              指派 / 转派
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={false}
                              onSelect={(e) => {
                                e.preventDefault();
                                const qs = buildQueryString({
                                  base: sp,
                                  patch: { id: t.id, action: 'override' },
                                });
                                router.replace(`/admin/tasks${qs ? `?${qs}` : ''}`);
                              }}
                            >
                              覆写状态
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={false}
                              onSelect={(e) => {
                                e.preventDefault();
                                const qs = buildQueryString({
                                  base: sp,
                                  patch: { id: t.id, action: 'note' },
                                });
                                router.replace(`/admin/tasks${qs ? `?${qs}` : ''}`);
                              }}
                            >
                              添加备注
                            </DropdownMenuCheckboxItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="p-4">
          <UsersPagination
            page={pageState.page}
            pageSize={pageState.pageSize}
            total={total}
            onChange={(page, pageSize) => {
              if (page < 1) return;
              const qs = buildQueryString({
                base: sp,
                patch: { page, pageSize },
              });
              router.replace(`/admin/tasks${qs ? `?${qs}` : ''}`);
            }}
          />
        </div>
      </div>

      <TaskDetailDrawer
        open={drawerOpen}
        taskId={drawerTaskId}
        action={drawerAction}
        onClearAction={() => {
          const qs = buildQueryString({
            base: sp,
            patch: { action: null },
          });
          router.replace(`/admin/tasks${qs ? `?${qs}` : ''}`);
        }}
        onClose={() => {
          const qs = buildQueryString({
            base: sp,
            patch: { id: null, action: null },
          });
          router.replace(`/admin/tasks${qs ? `?${qs}` : ''}`);
        }}
        onOpenOrder={(orderId) => {
          router.push(`/admin/orders?id=${encodeURIComponent(orderId)}`);
        }}
      />

      <Dialog open={batchAssignOpen} onOpenChange={setBatchAssignOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>批量指派处理人（{selectedIds.length} 条）</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">搜索用户</div>
              <div className="flex items-center gap-2">
                <Input
                  value={assigneeKeyword}
                  onChange={(e) => setAssigneeKeyword(e.target.value)}
                  placeholder="手机号 / 邮箱 / 昵称 / 用户ID"
                />
                <Button
                  variant="outline"
                  onClick={loadAssignees}
                  disabled={assigneeLoading || batchSaving}
                >
                  {assigneeLoading ? '加载中' : '搜索'}
                </Button>
              </div>
            </div>
            <div className="max-h-60 overflow-auto rounded-md border border-slate-200">
              {assigneeResults.length === 0 ? (
                <div className="p-3 text-sm text-slate-500">暂无结果</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {assigneeResults.map((u) => (
                    <button
                      key={String(u.id)}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50"
                      onClick={() => doBatchAssign(String(u.id))}
                      disabled={batchSaving}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {u.nickname || u.email || u.phone || u.id}
                        </div>
                        <div className="truncate font-mono text-xs text-slate-500">{u.id}</div>
                      </div>
                      <div className="text-xs text-slate-500">{u.role}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500">或手动输入用户ID</div>
              <div className="flex items-center gap-2">
                <Input
                  value={assigneeIdInput}
                  onChange={(e) => setAssigneeIdInput(e.target.value)}
                  placeholder="用户ID"
                />
                <Button
                  onClick={() => doBatchAssign(assigneeIdInput)}
                  disabled={batchSaving || !assigneeIdInput.trim()}
                >
                  指派
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchAssignOpen(false)} disabled={batchSaving}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchOverrideOpen} onOpenChange={setBatchOverrideOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>批量覆写状态（{selectedIds.length} 条）</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">目标状态</div>
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={overrideTarget}
                onChange={(e) => setOverrideTarget(e.target.value as BackendTaskStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} ({s.value})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500">原因（必填，统一原因）</div>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="将写入审计日志"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOverrideOpen(false)} disabled={batchSaving}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => setBatchConfirmOverrideOpen(true)}
              disabled={batchSaving || !overrideReason.trim()}
            >
              下一步确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchConfirmOverrideOpen} onOpenChange={setBatchConfirmOverrideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认批量覆写？</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600">
            将覆写 {selectedIds.length} 条任务状态为 {overrideTarget}，并写入审计日志。
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchConfirmOverrideOpen(false)} disabled={batchSaving}>
              取消
            </Button>
            <Button variant="destructive" onClick={doBatchOverride} disabled={batchSaving}>
              确认覆写
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchUnlinkOpen} onOpenChange={setBatchUnlinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认批量解除关联订单？</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600">
            将对 {selectedIds.length} 条任务尝试解除订单关联（无关联的任务会被跳过），并写入审计日志。
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchUnlinkOpen(false)} disabled={batchSaving}>
              取消
            </Button>
            <Button variant="destructive" onClick={doBatchUnlinkOrders} disabled={batchSaving}>
              确认解除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
