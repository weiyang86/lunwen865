import { adminApi } from '@/lib/admin/api-client';
import { adminAuth } from '@/lib/admin/auth';
import type {
  ModelConfig,
  PromptMetadata,
  PromptDraft,
  PromptListQuery,
  PromptStatus,
  PromptTemplate,
  PromptTemplateDetail,
  PromptVariable,
  PromptVersion,
} from '@/types/prompt';

type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ListVersionsParams = {
  templateId: string;
  cursor?: string;
  limit?: number;
};

export type ListVersionsResult = {
  items: PromptVersion[];
  nextCursor: string | null;
};

export type RunPromptTestRequest = {
  content: string;
  variables: PromptVariable[];
  variableValues: Record<string, unknown>;
  modelConfig: ModelConfig;
  metadata: PromptMetadata;
  stream: true;
  timeoutMs?: number;
};

export interface RunPromptTestHandlers {
  onStart: (e: { runId: string; model: string; startedAt: string }) => void;
  onChunk: (e: { delta: string }) => void;
  onUsage: (e: { inputTokens: number; outputTokens: number }) => void;
  onDone: (e: { finishReason: string; durationMs: number }) => void;
  onError: (e: { code: string; message: string; retryAfterMs?: number }) => void;
}

export interface RunPromptTestController {
  abort: () => void;
}

function parseSseBlock(block: string): { event?: string; data?: string } {
  const lines = block.split('\n').map((l) => l.trimEnd());
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  return { event, data: dataLines.join('\n') };
}

export function runPromptTest(
  promptId: string,
  body: RunPromptTestRequest,
  handlers: RunPromptTestHandlers,
): RunPromptTestController {
  const controller = new AbortController();
  let finished = false;

  const baseURL = (adminApi.defaults.baseURL ?? '').replace(/\/$/, '');
  const url = `${baseURL}/prompts/${promptId}/test`;

  const token = adminAuth.getToken();

  const run = async () => {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!resp.ok) {
        handlers.onError({
          code: resp.status === 429 ? 'rate_limited' : 'network',
          message: `请求失败 (${resp.status})`,
        });
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) {
        handlers.onError({ code: 'network', message: '响应流不可用' });
        return;
      }

      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';

        for (const part of parts) {
          const { event, data } = parseSseBlock(part);
          if (!event) continue;
          if (!data) continue;
          if (!['start', 'chunk', 'usage', 'done', 'error'].includes(event)) {
            console.warn('[runPromptTest] unexpected SSE event', event);
            continue;
          }
          let payload: any;
          try {
            payload = JSON.parse(data);
          } catch {
            continue;
          }
          if (event === 'start') handlers.onStart(payload);
          else if (event === 'chunk') handlers.onChunk(payload);
          else if (event === 'usage') handlers.onUsage(payload);
          else if (event === 'done') handlers.onDone(payload);
          else if (event === 'error') handlers.onError(payload);
        }
      }
    } catch (e: any) {
      if (controller.signal.aborted) {
        if (!finished) {
          finished = true;
          handlers.onError({ code: 'aborted', message: '已中止' });
        }
        return;
      }
      handlers.onError({ code: 'network', message: e?.message || '网络异常' });
    }
  };

  void run();

  return {
    abort: () => {
      if (finished) return;
      finished = true;
      controller.abort();
      handlers.onError({ code: 'aborted', message: '已中止' });
    },
  };
}

export const promptApi = {
  list: (q: PromptListQuery, signal?: AbortSignal) =>
    adminApi
      .get<Paged<PromptTemplate>>('/admin/prompts', { params: q, signal })
      .then((r) => r.data),

  detail: (id: string, signal?: AbortSignal) =>
    adminApi
      .get<PromptTemplateDetail>(`/admin/prompts/${id}`, { signal })
      .then((r) => r.data),

  create: (p: { sceneKey: string; name: string; description: string; tags: string[] }) =>
    adminApi.post<PromptTemplate>('/admin/prompts', p).then((r) => r.data),

  remove: (id: string) => adminApi.delete(`/admin/prompts/${id}`).then((r) => r.data),

  listAllTags: () => adminApi.get<string[]>('/admin/prompts/tags').then((r) => r.data),

  updateMeta: (
    id: string,
    p: { name: string; description: string; tags: string[]; status: PromptStatus },
  ) => adminApi.put<PromptTemplate>(`/admin/prompts/${id}`, p).then((r) => r.data),

  saveDraft: (templateId: string, p: Omit<PromptDraft, 'templateId' | 'updatedAt'>) =>
    adminApi
      .put<PromptDraft>(`/admin/prompts/${templateId}/draft`, p)
      .then((r) => r.data),

  discardDraft: (templateId: string) =>
    adminApi.delete(`/admin/prompts/${templateId}/draft`).then((r) => r.data),

  listModels: () =>
    adminApi
      .get<{ id: string; label: string; provider: string }[]>('/admin/prompts/models')
      .then((r) => r.data),

  publishVersion: (templateId: string, p: { changelog: string }) =>
    adminApi
      .post<PromptVersion>(`/admin/prompts/${templateId}/versions`, p)
      .then((r) => r.data),

  createVersion: (
    templateId: string,
    payload: {
      content: string;
      variables: PromptVariable[];
      modelConfig: ModelConfig;
      metadata: PromptMetadata;
      commitMessage: string;
    },
  ) =>
    adminApi.post<PromptVersion>(`/prompts/${templateId}/versions`, payload).then((r) => r.data),

  listVersions: (p: ListVersionsParams) =>
    adminApi
      .get<ListVersionsResult>(`/admin/prompts/${p.templateId}/versions`, {
        params: { cursor: p.cursor, limit: p.limit },
      })
      .then((r) => r.data),

  getVersion: (templateId: string, versionId: string) =>
    adminApi
      .get<PromptVersion>(`/admin/prompts/${templateId}/versions/${versionId}`)
      .then((r) => r.data),

  rollback: (templateId: string, versionNo: number) =>
    adminApi
      .post<PromptVersion>(`/admin/prompts/${templateId}/rollback`, { versionNo })
      .then((r) => r.data),

  testRun: (templateId: string, p: { variables: Record<string, string> }) =>
    adminApi
      .post<{ rendered: string; output: string; usage: any }>(
        `/admin/prompts/${templateId}/test-run`,
        p,
      )
      .then((r) => r.data),
};
