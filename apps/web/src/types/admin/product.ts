export type ProductStatus = 'ON_SALE' | 'OFF_SHELF' | 'DRAFT';

export interface ProductListItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  coverUrl: string | null;
  status: ProductStatus;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  soldCount: number;
  updatedAt: string;
}

export interface ProductDetail {
  id: string;
  code: string;
  name: string;
  description: string;
  coverUrl: string | null;
  priceCents: number;
  originalPriceCents: number | null;
  brainCellAmount: number;
  paperQuota: number;
  polishQuota: number;
  exportQuota: number;
  aiChatQuota: number;
  sortOrder: number;
  status: ProductStatus;
  categoryId: string | null;
  totalStock: number;
  soldCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface ProductListQuery {
  categoryId?: string;
  includeSubCategory?: boolean;
  keyword?: string;
  status?: ProductStatus | 'ALL';
  page: number;
  pageSize: number;
}

export interface ProductListResp {
  list: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
}
