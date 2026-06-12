import { adminHttp } from '@/lib/admin/api-client';

export type PageResp<T> = { items: T[]; total: number; page: number; pageSize: number };
export type ThesisFormatTemplate = { id: string; name: string; code: string; description?: string | null; status: string; templateType: string; isDefault: boolean; version: number; sortOrder: number; schoolId?: string | null; collegeId?: string | null; majorId?: string | null; educationLevel?: string | null; thesisType?: string | null; stage?: string | null; school?: { name: string } | null; college?: { name: string } | null; major?: { name: string } | null };
export type ThesisFormatRule = { id: string; templateId: string; ruleType: string; ruleKey: string; ruleValue: unknown; description?: string | null; sortOrder: number };
export type ThesisExportJob = { id: string; taskId: string; exportStage: string; exportFormat: string; status: string; progress: number; fileName?: string | null; fileSize?: number | null; errorMessage?: string | null; customRequirement?: string | null; createdAt: string; template?: { name: string } | null; task?: { title: string | null } | null; user?: { nickname?: string | null; phone?: string | null; email?: string | null } | null };

export const thesisExportAdminApi = {
  templates: (params?: Record<string, unknown>) => adminHttp.get<PageResp<ThesisFormatTemplate>>('/admin/thesis-format-templates', params),
  createTemplate: (body: unknown) => adminHttp.post<ThesisFormatTemplate>('/admin/thesis-format-templates', body),
  updateTemplate: (id: string, body: unknown) => adminHttp.patch<ThesisFormatTemplate>(`/admin/thesis-format-templates/${id}`, body),
  disableTemplate: (id: string) => adminHttp.delete<ThesisFormatTemplate>(`/admin/thesis-format-templates/${id}`),
  rules: (id: string) => adminHttp.get<ThesisFormatRule[]>(`/admin/thesis-format-templates/${id}/rules`),
  createRule: (id: string, body: unknown) => adminHttp.post<ThesisFormatRule>(`/admin/thesis-format-templates/${id}/rules`, body),
  updateRule: (id: string, body: unknown) => adminHttp.patch<ThesisFormatRule>(`/admin/thesis-format-rules/${id}`, body),
  deleteRule: (id: string) => adminHttp.delete(`/admin/thesis-format-rules/${id}`),
  jobs: (params?: Record<string, unknown>) => adminHttp.get<PageResp<ThesisExportJob>>('/admin/thesis-export-jobs', params),
  retryJob: (id: string) => adminHttp.post<ThesisExportJob>(`/admin/thesis-export-jobs/${id}/retry`, {}),
};
