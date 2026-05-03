export type StoreStatus = 'OPEN' | 'PAUSED' | 'CLOSED';

export interface BusinessHourSlot {
  open: string;
  close: string;
}

export type BusinessHours = Record<number, BusinessHourSlot[]>;

export interface Store {
  id: string;
  name: string;
  code: string;
  status: StoreStatus;
  phone: string | null;
  address: string;
  longitude: number | null;
  latitude: number | null;
  businessHours: BusinessHours;
  description: string | null;
  managerName: string | null;
  managerPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreListQuery {
  keyword?: string;
  status?: StoreStatus | 'ALL';
  page: number;
  pageSize: number;
}

export interface StoreListResp {
  list: Store[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StoreUpsertPayload {
  name: string;
  code: string;
  phone?: string;
  address: string;
  longitude?: number;
  latitude?: number;
  businessHours: BusinessHours;
  description?: string;
  managerName?: string;
  managerPhone?: string;
}
