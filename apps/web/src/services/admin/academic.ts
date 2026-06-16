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
} from '@/types/admin/academic';

export type ListParams = Record<string, string | number | undefined>;

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  issues: { sheet: string; row: number; message: string }[];
};

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
  downloadSchoolImportTemplate: () =>
    adminApi
      .get('/admin/academic/schools/import-template', { responseType: 'blob' })
      .then((r) => r.data as Blob),
  importSchools: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return adminApi
      .post('/admin/academic/schools/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data as ImportResult);
  },

  colleges: (params?: ListParams) => adminHttp.get<PageResp<AcademicCollege>>('/admin/academic/colleges', params),
  createCollege: (body: unknown) => adminHttp.post<AcademicCollege>('/admin/academic/colleges', body),
  updateCollege: (id: string, body: unknown) => adminHttp.patch<AcademicCollege>(`/admin/academic/colleges/${id}`, body),
  disableCollege: (id: string) => adminHttp.delete<AcademicCollege>(`/admin/academic/colleges/${id}`),
  downloadCollegeImportTemplate: () =>
    adminApi
      .get('/admin/academic/colleges/import-template', { responseType: 'blob' })
      .then((r) => r.data as Blob),
  importColleges: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return adminApi
      .post('/admin/academic/colleges/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data as ImportResult);
  },

  majors: (params?: ListParams) => adminHttp.get<PageResp<AcademicMajor>>('/admin/academic/majors', params),
  createMajor: (body: unknown) => adminHttp.post<AcademicMajor>('/admin/academic/majors', body),
  updateMajor: (id: string, body: unknown) => adminHttp.patch<AcademicMajor>(`/admin/academic/majors/${id}`, body),
  disableMajor: (id: string) => adminHttp.delete<AcademicMajor>(`/admin/academic/majors/${id}`),
  downloadMajorImportTemplate: () =>
    adminApi
      .get('/admin/academic/majors/import-template', { responseType: 'blob' })
      .then((r) => r.data as Blob),
  importMajors: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return adminApi
      .post('/admin/academic/majors/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data as ImportResult);
  },

  disciplines: () => adminHttp.get<DisciplineTree>('/admin/academic/disciplines'),
  downloadDisciplineImportTemplate: () =>
    adminApi
      .get('/admin/academic/disciplines/import-template', {
        responseType: 'blob',
      })
      .then((r) => r.data as Blob),
  importDisciplines: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return adminApi
      .post('/admin/academic/disciplines/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data as ImportResult);
  },
  createCategory: (body: unknown) => adminHttp.post<DisciplineCategory>('/admin/academic/disciplines/categories', body),
  updateCategory: (id: string, body: unknown) => adminHttp.patch<DisciplineCategory>(`/admin/academic/disciplines/categories/${id}`, body),
  disableCategory: (id: string) => adminHttp.delete<DisciplineCategory>(`/admin/academic/disciplines/categories/${id}`),
  createLevelOne: (body: unknown) => adminHttp.post<DisciplineLevelOne>('/admin/academic/disciplines/level-ones', body),
  updateLevelOne: (id: string, body: unknown) => adminHttp.patch<DisciplineLevelOne>(`/admin/academic/disciplines/level-ones/${id}`, body),
  disableLevelOne: (id: string) => adminHttp.delete<DisciplineLevelOne>(`/admin/academic/disciplines/level-ones/${id}`),
  createLevelTwo: (body: unknown) => adminHttp.post<DisciplineLevelTwo>('/admin/academic/disciplines/level-twos', body),
  updateLevelTwo: (id: string, body: unknown) => adminHttp.patch<DisciplineLevelTwo>(`/admin/academic/disciplines/level-twos/${id}`, body),
  disableLevelTwo: (id: string) => adminHttp.delete<DisciplineLevelTwo>(`/admin/academic/disciplines/level-twos/${id}`),
};
