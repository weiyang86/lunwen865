import { adminApi } from '@/lib/admin/api-client';
import type {
  PromptListQuery,
  PromptListResp,
  PromptSceneMeta,
  PromptTemplate,
  PromptTemplateDetail,
} from '@/types/admin/prompt';

export async function fetchPromptScenes(): Promise<PromptSceneMeta[]> {
  const { data } = await adminApi.get<PromptSceneMeta[]>(
    '/admin/prompt-templates/meta/scenes',
  );
  return data;
}

export async function fetchPrompts(
  q: PromptListQuery,
  signal?: AbortSignal,
): Promise<PromptListResp> {
  const params: Record<string, unknown> = {
    page: q.page,
    pageSize: q.pageSize,
    keyword: q.keyword || undefined,
  };

  if (q.status && q.status !== 'ALL') params.status = q.status;
  if (q.scenes && q.scenes.length > 0) params.scene = q.scenes[0];

  const { data } = await adminApi.get<PromptListResp>('/admin/prompt-templates', {
    params,
    signal,
  });
  return data;
}

export async function fetchPromptDetail(
  id: string,
  signal?: AbortSignal,
): Promise<PromptTemplateDetail> {
  const { data } = await adminApi.get<PromptTemplateDetail>(
    `/admin/prompt-templates/${id}`,
    { signal },
  );
  return data;
}

export async function createPrompt(p: {
  code: string;
  name: string;
  scene: string;
  description?: string;
}): Promise<PromptTemplate> {
  const { data } = await adminApi.post<PromptTemplate>('/admin/prompt-templates', {
    code: p.code,
    name: p.name,
    scene: p.scene,
    description: p.description || undefined,
    content: '编辑器加载中（7A-2）',
    variables: [],
  });
  return data;
}

export async function removePrompt(id: string): Promise<{ success: true }> {
  const { data } = await adminApi.delete<{ success: true }>(
    `/admin/prompt-templates/${id}`,
  );
  return data;
}

