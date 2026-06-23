import { adminApi, adminHttp } from '@/lib/admin/api-client';
import type {
  AcademicCity,
  AcademicCollege,
  AcademicMajor,
  AcademicProvince,
  AcademicSchool,
  DisciplineCategory,
  DisciplineLevelOne,
  DisciplineLevelTwo,
  DisciplineTree,
  PageResp,
  AcademicSyncLog,
  RegionSyncPreview,
  RegionSyncStatus,
  AcademicRegion,
  SchoolImportPreview,
  SchoolImportConfirmResult,
} from '@/types/admin/academic';

export type ListParams = Record<string, string | number | undefined>;

export const academicApi = {
  provinces: () => adminHttp.get<AcademicProvince[]>('/academic/provinces'),
  cities: (provinceId: string) => adminHttp.get<AcademicCity[]>('/academic/cities', { provinceId }),
  publicSchools: (params?: ListParams) => adminHttp.get<PageResp<AcademicSchool>>('/academic/schools', params),
  publicColleges: (schoolId: string) => adminHttp.get<PageResp<AcademicCollege>>('/academic/colleges', { schoolId, pageSize: 100 }),
  publicMajors: (params?: ListParams) => adminHttp.get<PageResp<AcademicMajor>>('/academic/majors', params),
  categories: () => adminHttp.get<DisciplineCategory[]>('/academic/disciplines/categories'),
  levelOnes: (categoryId: string) => adminHttp.get<DisciplineLevelOne[]>('/academic/disciplines/level-ones', { categoryId }),
  levelTwos: (levelOneId: string) => adminHttp.get<DisciplineLevelTwo[]>('/academic/disciplines/level-twos', { levelOneId }),

  schools: (params?: ListParams) => adminHttp.get<PageResp<AcademicSchool>>('/admin/academic/schools', params),
  createSchool: (body: unknown) => adminHttp.post<AcademicSchool>('/admin/academic/schools', body),
  updateSchool: (id: string, body: unknown) => adminHttp.patch<AcademicSchool>(`/admin/academic/schools/${id}`, body),
  disableSchool: (id: string) => adminHttp.delete<AcademicSchool>(`/admin/academic/schools/${id}`),

  colleges: (params?: ListParams) => adminHttp.get<PageResp<AcademicCollege>>('/admin/academic/colleges', params),
  createCollege: (body: unknown) => adminHttp.post<AcademicCollege>('/admin/academic/colleges', body),
  updateCollege: (id: string, body: unknown) => adminHttp.patch<AcademicCollege>(`/admin/academic/colleges/${id}`, body),
  disableCollege: (id: string) => adminHttp.delete<AcademicCollege>(`/admin/academic/colleges/${id}`),

  majors: (params?: ListParams) => adminHttp.get<PageResp<AcademicMajor>>('/admin/academic/majors', params),
  createMajor: (body: unknown) => adminHttp.post<AcademicMajor>('/admin/academic/majors', body),
  updateMajor: (id: string, body: unknown) => adminHttp.patch<AcademicMajor>(`/admin/academic/majors/${id}`, body),
  disableMajor: (id: string) => adminHttp.delete<AcademicMajor>(`/admin/academic/majors/${id}`),

  disciplines: () => adminHttp.get<DisciplineTree>('/admin/academic/disciplines'),
  createCategory: (body: unknown) => adminHttp.post<DisciplineCategory>('/admin/academic/disciplines/categories', body),
  updateCategory: (id: string, body: unknown) => adminHttp.patch<DisciplineCategory>(`/admin/academic/disciplines/categories/${id}`, body),
  disableCategory: (id: string) => adminHttp.delete<DisciplineCategory>(`/admin/academic/disciplines/categories/${id}`),
  createLevelOne: (body: unknown) => adminHttp.post<DisciplineLevelOne>('/admin/academic/disciplines/level-ones', body),
  updateLevelOne: (id: string, body: unknown) => adminHttp.patch<DisciplineLevelOne>(`/admin/academic/disciplines/level-ones/${id}`, body),
  disableLevelOne: (id: string) => adminHttp.delete<DisciplineLevelOne>(`/admin/academic/disciplines/level-ones/${id}`),
  createLevelTwo: (body: unknown) => adminHttp.post<DisciplineLevelTwo>('/admin/academic/disciplines/level-twos', body),
  updateLevelTwo: (id: string, body: unknown) => adminHttp.patch<DisciplineLevelTwo>(`/admin/academic/disciplines/level-twos/${id}`, body),
  disableLevelTwo: (id: string) => adminHttp.delete<DisciplineLevelTwo>(`/admin/academic/disciplines/level-twos/${id}`),

  regionSyncStatus: () => adminHttp.get<RegionSyncStatus>('/admin/academic/sync/regions/amap/status'),
  previewRegionSync: () => adminHttp.post<RegionSyncPreview>('/admin/academic/sync/regions/amap/preview', {}),
  confirmRegionSync: () => adminHttp.post<{ total: number; jobId: string }>('/admin/academic/sync/regions/amap/confirm', {}),
  syncLogs: (params?: ListParams) => adminHttp.get<PageResp<AcademicSyncLog>>('/admin/academic/sync/logs', params),
  regions: (params?: ListParams) => adminHttp.get<PageResp<AcademicRegion>>('/admin/academic/regions', params),
  previewSchoolImport: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return adminApi.post<SchoolImportPreview, { data: SchoolImportPreview }>('/admin/academic-data/schools/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 }).then((r) => r.data);
  },
  confirmSchoolImport: (previewId: string) => adminHttp.post<SchoolImportConfirmResult>('/admin/academic-data/schools/import/confirm', { previewId }),
  schoolImportTemplateUrl: (version: 'legacy' | 'extended') => `/api/admin/academic-data/schools/import/template?version=${version}`,
  previewMajorCatalogImport: (file: File) => { const form = new FormData(); form.append('file', file); return adminApi.post<SchoolImportPreview, { data: SchoolImportPreview }>('/admin/academic-data/majors/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 }).then((r) => r.data); },
  confirmMajorCatalogImport: (previewId: string) => adminHttp.post<SchoolImportConfirmResult>('/admin/academic-data/majors/import/confirm', { previewId }),
  majorCatalogTemplateUrl: () => '/api/admin/academic-data/majors/import/template',
  previewDisciplineCatalogImport: (file: File) => { const form = new FormData(); form.append('file', file); return adminApi.post<SchoolImportPreview, { data: SchoolImportPreview }>('/admin/academic-data/disciplines/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 }).then((r) => r.data); },
  confirmDisciplineCatalogImport: (previewId: string) => adminHttp.post<SchoolImportConfirmResult>('/admin/academic-data/disciplines/import/confirm', { previewId }),
  disciplineCatalogTemplateUrl: () => '/api/admin/academic-data/disciplines/import/template',
  previewCollegeImport: (file: File) => { const form = new FormData(); form.append('file', file); return adminApi.post<SchoolImportPreview, { data: SchoolImportPreview }>('/admin/academic-data/colleges/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 }).then((r) => r.data); },
  confirmCollegeImport: (previewId: string) => adminHttp.post<SchoolImportConfirmResult>('/admin/academic-data/colleges/import/confirm', { previewId }),
  collegeImportTemplateUrl: () => '/api/admin/academic-data/colleges/import/template',
  previewSchoolMajorImport: (file: File) => { const form = new FormData(); form.append('file', file); return adminApi.post<SchoolImportPreview, { data: SchoolImportPreview }>('/admin/academic-data/school-majors/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 }).then((r) => r.data); },
  confirmSchoolMajorImport: (previewId: string) => adminHttp.post<SchoolImportConfirmResult>('/admin/academic-data/school-majors/import/confirm', { previewId }),
  schoolMajorImportTemplateUrl: () => '/api/admin/academic-data/school-majors/import/template',
  runSchoolMajorCrawl: (body: { schoolCode: string; url: string; educationLevel: string }) => adminHttp.post<{ created: number; sampleRows: unknown[] }>('/admin/academic-data/school-majors/crawl/run', body),
  previewPostgraduateProgramImport: (file: File) => { const form = new FormData(); form.append('file', file); return adminApi.post<SchoolImportPreview, { data: SchoolImportPreview }>('/admin/academic-data/postgraduate-programs/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 }).then((r) => r.data); },
  confirmPostgraduateProgramImport: (previewId: string) => adminHttp.post<SchoolImportConfirmResult>('/admin/academic-data/postgraduate-programs/import/confirm', { previewId }),
  postgraduateProgramTemplateUrl: () => '/api/admin/academic-data/postgraduate-programs/import/template',
  runPostgraduateProgramCrawl: (body: { schoolCode: string; url: string; degreeLevel: string; sourceType: string }) => adminHttp.post<{ created: number; sampleRows: unknown[] }>('/admin/academic-data/postgraduate-programs/crawl/run', body),
};
