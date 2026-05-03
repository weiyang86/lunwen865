export type PromptStatus = 'ENABLED' | 'DISABLED';

export type VariableType = 'text' | 'textarea' | 'number' | 'select';

export interface PromptVariable {
  name: string;
  label: string;
  type: VariableType;
  required: boolean;
  defaultValue?: string;
  description?: string;
  options?: string[];
  maxLength?: number;
}

export interface ModelParams {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export const DEFAULT_MODEL_PARAMS: ModelParams = {
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

export interface ModelConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 2048,
};

export interface PromptMetadata {
  title: string;
  description: string;
  tags: string[];
}

export interface PromptTemplate {
  id: string;
  sceneKey: string;
  name: string;
  description: string;
  tags: string[];
  currentVersionNo: number | null;
  status: PromptStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy: { id: string; name: string; avatar: string | null } | null;
}

export interface PromptVersion {
  id: string;
  templateId: string;
  versionNo: number;
  content: string;
  variables: PromptVariable[];
  modelConfig: ModelConfig;
  metadata: PromptMetadata;
  changelog: string;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
}

export interface PromptDraft {
  templateId: string;
  content: string;
  variables: PromptVariable[];
  modelConfig: ModelConfig;
  metadata: PromptMetadata;
  updatedAt: string;
}

export interface PromptTemplateDetail extends PromptTemplate {
  currentVersion: PromptVersion | null;
  draft: PromptDraft | null;
}

export interface PromptListQuery {
  keyword?: string;
  tags?: string[];
  status?: PromptStatus;
  page: number;
  pageSize: number;
}
