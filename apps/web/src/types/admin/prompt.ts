export type PromptStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export type PromptScene = string;

export interface PromptVariable {
  name: string;
  label?: string;
  required?: boolean;
  defaultValue?: string;
  description?: string;
}

export interface PromptTemplate {
  id: string;
  code: string;
  name: string;
  scene: PromptScene;
  description: string | null;
  status: PromptStatus;
  currentVersion: number | null;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptVersion {
  id: string;
  templateId: string;
  version: number;
  content: string;
  variables: PromptVariable[];
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
  createdAt: string;
  createdBy: string;
}

export interface PromptTemplateDetail extends PromptTemplate {
  content: string;
  variables: PromptVariable[];
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
  versions: PromptVersion[];
}

export interface PromptListQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: 'ALL' | PromptStatus;
  scenes?: string[];
}

export interface PromptListResp {
  items: PromptTemplate[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PromptSceneMeta {
  value: string;
  label: string;
}

