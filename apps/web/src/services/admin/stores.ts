import { adminHttp } from '@/lib/admin/api-client';
import type { Store, StoreListQuery, StoreListResp, StoreUpsertPayload } from '@/types/admin/store';

export async function fetchStores(query: StoreListQuery) {
  return adminHttp.get<StoreListResp>('/admin/stores', query);
}

export async function fetchStore(id: string) {
  return adminHttp.get<Store>(`/admin/stores/${id}`);
}

export async function createStore(payload: StoreUpsertPayload) {
  return adminHttp.post<Store>('/admin/stores', payload);
}

export async function updateStore(id: string, payload: StoreUpsertPayload) {
  return adminHttp.put<Store>(`/admin/stores/${id}`, payload);
}

export async function updateStoreStatus(id: string, status: 'OPEN' | 'PAUSED') {
  return adminHttp.patch<Store>(`/admin/stores/${id}/status`, { status });
}

export async function removeStore(id: string) {
  return adminHttp.delete<{ id: string }>(`/admin/stores/${id}`);
}
