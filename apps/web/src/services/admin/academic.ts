import { adminHttp } from '@/lib/admin/api-client';
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
};
