export type UserStatus = 'ACTIVE' | 'DISABLED';
export type UserRole = 'USER' | 'VIP' | 'TUTOR' | 'ADMIN' | 'SUPER_ADMIN';

export interface AdminUser {
  id: string;
  phone: string;
  nickname: string;
  email: string | null;
  avatar: string | null;
  status: UserStatus;
  role?: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserDetail extends AdminUser {
  _count?: { orders: number };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListUsersQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: 'ACTIVE' | 'DISABLED' | 'ALL';
  role?: UserRole;
}
