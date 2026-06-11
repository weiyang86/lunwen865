import { adminHttp } from '@/lib/admin/api-client';
import type {
  PageResp,
  ThesisSkill,
  ThesisSkillBinding,
  ThesisSkillRun,
  ThesisSkillVersion,
} from '@/types/admin/thesis-skill';

type Params = Record<string, string | number | undefined>;

export const thesisSkillApi = {
  list: (params?: Params) => adminHttp.get<PageResp<ThesisSkill>>('/admin/thesis-skills', params),
  create: (body: unknown) => adminHttp.post<ThesisSkill>('/admin/thesis-skills', body),
  detail: (id: string) => adminHttp.get<ThesisSkill>(`/admin/thesis-skills/${id}`),
  update: (id: string, body: unknown) => adminHttp.patch<ThesisSkill>(`/admin/thesis-skills/${id}`, body),
  disable: (id: string) => adminHttp.delete<ThesisSkill>(`/admin/thesis-skills/${id}`),

  versions: (id: string) => adminHttp.get<ThesisSkillVersion[]>(`/admin/thesis-skills/${id}/versions`),
  createVersion: (id: string, body: unknown) => adminHttp.post<ThesisSkillVersion>(`/admin/thesis-skills/${id}/versions`, body),
  updateVersion: (versionId: string, body: unknown) => adminHttp.patch<ThesisSkillVersion>(`/admin/thesis-skills/versions/${versionId}`, body),
  activateVersion: (versionId: string) => adminHttp.post<ThesisSkillVersion>(`/admin/thesis-skills/versions/${versionId}/activate`),

  bindings: (id: string) => adminHttp.get<ThesisSkillBinding[]>(`/admin/thesis-skills/${id}/bindings`),
  createBinding: (id: string, body: unknown) => adminHttp.post<ThesisSkillBinding>(`/admin/thesis-skills/${id}/bindings`, body),
  updateBinding: (bindingId: string, body: unknown) => adminHttp.patch<ThesisSkillBinding>(`/admin/thesis-skills/bindings/${bindingId}`, body),
  disableBinding: (bindingId: string) => adminHttp.delete<ThesisSkillBinding>(`/admin/thesis-skills/bindings/${bindingId}`),

  testRun: (id: string, body: unknown) => adminHttp.post<ThesisSkillRun>(`/admin/thesis-skills/${id}/test-run`, body),
  runs: (params?: Params) => adminHttp.get<PageResp<ThesisSkillRun>>('/admin/thesis-skills/runs', params),
  runDetail: (id: string) => adminHttp.get<ThesisSkillRun>(`/admin/thesis-skills/runs/${id}`),
};
