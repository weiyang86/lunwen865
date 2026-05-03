export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  sort: number;
  iconUrl: string | null;
  productCount: number;
  children?: Category[];
}

export interface CategoryUpsertPayload {
  parentId: string | null;
  name: string;
  iconUrl?: string;
}

export interface CategoryReorderPayload {
  parentId: string | null;
  orderedIds: string[];
}

