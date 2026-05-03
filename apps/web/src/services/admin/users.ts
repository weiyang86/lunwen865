import { adminHttp } from '@/lib/admin/api-client';
import type {
  AdminUser,
  AdminUserDetail,
  ListUsersQuery,
  PaginatedResult,
  UserStatus,
} from '@/types/admin/user';

export async function fetchUsers(q: ListUsersQuery) {
  return adminHttp.get<PaginatedResult<AdminUser>>('/admin/users', q);
}

export async function fetchUser(id: string) {
  return adminHttp.get<AdminUserDetail>(`/admin/users/${id}`);
}

export async function updateUserStatus(id: string, status: UserStatus) {
  return adminHttp.patch<{ id: string; status: UserStatus }>(
    `/admin/users/${id}/status`,
    { status },
  );
}
