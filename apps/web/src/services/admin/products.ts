import { adminApi, adminHttp } from '@/lib/admin/api-client';
import type { ProductDetail, ProductListQuery, ProductListResp, ProductStatus } from '@/types/admin/product';

export async function fetchProducts(q: ProductListQuery) {
  return adminHttp.get<ProductListResp>('/admin/products', q);
}

export type CreateProductPayload = {
  code: string;
  name: string;
  description?: string;
  coverUrl?: string;
  categoryId?: string;
  priceCents: number;
  originalPriceCents?: number;
  brainCellAmount?: number;
  paperQuota?: number;
  polishQuota?: number;
  exportQuota?: number;
  aiChatQuota?: number;
  sortOrder?: number;
};

export async function createProduct(payload: CreateProductPayload) {
  return adminHttp.post<{ id: string }>('/admin/products', payload);
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export async function fetchProductDetail(id: string) {
  return adminHttp.get<ProductDetail>(`/admin/products/${id}`);
}

export async function updateProduct(id: string, payload: UpdateProductPayload) {
  return adminHttp.put<{ id: string }>('/admin/products/' + id, payload);
}

export async function uploadProductCover(file: File) {
  const form = new FormData();
  form.append('file', file);
  const r = await adminApi.post<{ url: string }>(
    '/admin/products/upload-cover',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return r.data;
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
