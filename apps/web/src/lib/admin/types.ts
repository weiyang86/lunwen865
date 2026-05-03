export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role: 'ADMIN' | 'SUPER_ADMIN' | 'USER';
}

export interface ApiError {
  code: number;
  message: string;
  details?: unknown;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
