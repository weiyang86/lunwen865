import { adminHttp } from '@/lib/admin/api-client';
import type { DashboardStats } from '@/types/admin/dashboard';

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return adminHttp.get<DashboardStats>('/admin/dashboard/stats');
}

