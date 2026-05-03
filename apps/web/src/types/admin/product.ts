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

