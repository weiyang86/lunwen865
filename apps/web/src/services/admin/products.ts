import { adminHttp } from '@/lib/admin/api-client';
import type { ProductListQuery, ProductListResp, ProductStatus } from '@/types/admin/product';

export async function fetchProducts(q: ProductListQuery) {
  return adminHttp.get<ProductListResp>('/admin/products', q);
}

export async function updateProductStatus(id: string, status: 'ON_SALE' | 'OFF_SHELF') {
  return adminHttp.patch<{ id: string; status: ProductStatus }>(`/admin/products/${id}/status`, { status });
}

export async function batchUpdateProductStatus(ids: string[], status: 'ON_SALE' | 'OFF_SHELF') {
  return adminHttp.post<{ updated: number }>('/admin/products/batch-status', { ids, status });
}

export async function batchRemoveProducts(ids: string[]) {
  return adminHttp.post<{ removed: number }>('/admin/products/batch-remove', { ids });
}

export async function removeProduct(id: string) {
  return adminHttp.delete<{ id: string }>(`/admin/products/${id}`);
}
