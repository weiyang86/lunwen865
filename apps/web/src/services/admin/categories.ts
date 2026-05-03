import { adminHttp } from '@/lib/admin/api-client';
import type { Category, CategoryReorderPayload, CategoryUpsertPayload } from '@/types/admin/category';

export async function fetchCategoryTree() {
  return adminHttp.get<Category[]>('/admin/categories/tree');
}

export async function createCategory(p: CategoryUpsertPayload) {
  return adminHttp.post<Category>('/admin/categories', p);
}

export async function updateCategory(id: string, p: CategoryUpsertPayload) {
  return adminHttp.put<Category>(`/admin/categories/${id}`, p);
}

export async function removeCategory(id: string) {
  return adminHttp.delete<{ id: string }>(`/admin/categories/${id}`);
}

export async function reorderCategories(p: CategoryReorderPayload) {
  return adminHttp.post<{ ok: true }>('/admin/categories/reorder', p);
}

