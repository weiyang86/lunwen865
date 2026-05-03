import { adminApi, adminHttp } from '@/lib/admin/api-client';
import type { BackendTaskStage } from '@/types/order';

export type BackendTaskStatus =
  | 'INIT'
  | 'TOPIC_GENERATING'
  | 'TOPIC_PENDING_REVIEW'
  | 'TOPIC_APPROVED'
  | 'OPENING_GENERATING'
  | 'OPENING_PENDING_REVIEW'
  | 'OPENING_APPROVED'
  | 'OUTLINE_GENERATING'
  | 'OUTLINE_PENDING_REVIEW'
  | 'OUTLINE_APPROVED'
  | 'WRITING'
  | 'WRITING_PAUSED'
  | 'MERGING'
  | 'FORMATTING'
  | 'REVIEW'
  | 'REVISION'
  | 'DONE'
  | 'FAILED'
  | 'CANCELLED';

export type AdminTaskListItem = {
  id: string;
  title: string | null;
  educationLevel: string;
  status: BackendTaskStatus;
  currentStage: BackendTaskStage;
  deadline: string | null;
  userId: string;
  assignee?: { id: string; name: string; email: string | null } | null;
  isLinked: boolean;
  linkedOrderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListAdminTasksResp = {
  items: AdminTaskListItem[];
  nextCursor: string | null;
  total?: number;
  page?: number;
  pageSize?: number;
};

export type ListAdminTasksQuery = {
  userId?: string;
  search?: string;
  currentStage?: BackendTaskStage;
  statuses?: BackendTaskStatus[];
  orderNo?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  linkedOnly?: boolean;
  unlinkedOnly?: boolean;
  limit?: number;
  cursor?: string;
};

export type AdminTaskDetailResp = any;

export async function listAdminTasks(query: ListAdminTasksQuery): Promise<ListAdminTasksResp> {
  return adminHttp.get<ListAdminTasksResp>('/admin/tasks', query);
}

export async function getAdminTaskById(id: string): Promise<AdminTaskDetailResp> {
  return adminHttp.get<AdminTaskDetailResp>(`/admin/tasks/${id}`);
}

export async function assignAdminTask(
  id: string,
  assigneeId: string,
): Promise<AdminTaskDetailResp> {
  return adminHttp.patch<AdminTaskDetailResp>(`/admin/tasks/${id}/assign`, {
    assigneeId,
  });
}

export async function unassignAdminTask(id: string): Promise<AdminTaskDetailResp> {
  return adminHttp.patch<AdminTaskDetailResp>(`/admin/tasks/${id}/unassign`, {});
}

export async function overrideAdminTaskStatus(args: {
  id: string;
  targetStatus: BackendTaskStatus;
  reason: string;
}): Promise<AdminTaskDetailResp> {
  return adminHttp.patch<AdminTaskDetailResp>(
    `/admin/tasks/${args.id}/override-status`,
    { targetStatus: args.targetStatus, reason: args.reason },
  );
}

export async function addAdminTaskNote(args: {
  id: string;
  content: string;
}): Promise<AdminTaskDetailResp> {
  return adminHttp.post<AdminTaskDetailResp>(`/admin/tasks/${args.id}/admin-note`, {
    content: args.content,
  });
}

export async function batchAssignAdminTasks(args: {
  ids: string[];
  assigneeId: string;
}) {
  return adminHttp.post<{ success: boolean; affected: number }>(
    '/admin/tasks/batch/assign',
    args,
  );
}

export async function batchOverrideAdminTasksStatus(args: {
  ids: string[];
  targetStatus: BackendTaskStatus;
  reason: string;
}) {
  return adminHttp.post<{ success: boolean; affected: number }>(
    '/admin/tasks/batch/override-status',
    args,
  );
}

export async function batchUnlinkAdminTasksOrders(args: { ids: string[] }) {
  return adminHttp.post<{ success: boolean; affectedOrders: number }>(
    '/admin/tasks/batch/unlink-orders',
    args,
  );
}

export async function exportAdminTasksCsv(query: ListAdminTasksQuery) {
  const resp = await adminApi.get('/admin/tasks/export', {
    params: query,
    responseType: 'blob',
  });
  const cd = String((resp.headers as any)?.['content-disposition'] ?? '');
  const m = /filename="([^"]+)"/.exec(cd);
  const filename = m?.[1] ? decodeURIComponent(m[1]) : 'tasks.csv';
  return { blob: resp.data as Blob, filename };
}
