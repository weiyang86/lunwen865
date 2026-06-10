export type AcademicStatus = 'ACTIVE' | 'INACTIVE';

export type PageResp<T> = { list: T[]; total: number; page: number; pageSize: number };

export type AcademicProvince = { id: string; name: string; code: string; sortOrder: number; status: AcademicStatus };
export type AcademicCity = { id: string; provinceId: string; name: string; code: string; sortOrder: number; status: AcademicStatus };

export type AcademicSchool = {
  id: string;
  provinceId: string;
  cityId: string;
  name: string;
  code?: string | null;
  schoolType?: string | null;
  educationLevels: string[];
  status: AcademicStatus;
  sortOrder: number;
  remark?: string | null;
  province?: AcademicProvince;
  city?: AcademicCity;
};

export type AcademicCollege = {
  id: string;
  schoolId: string;
  name: string;
  code?: string | null;
  status: AcademicStatus;
  sortOrder: number;
  remark?: string | null;
  school?: AcademicSchool;
};

export type DisciplineCategory = { id: string; name: string; code: string; sortOrder: number; status: AcademicStatus };
export type DisciplineLevelOne = { id: string; categoryId: string; name: string; code: string; sortOrder: number; status: AcademicStatus; category?: DisciplineCategory };
export type DisciplineLevelTwo = { id: string; levelOneId: string; name: string; code: string; sortOrder: number; status: AcademicStatus; levelOne?: DisciplineLevelOne & { category?: DisciplineCategory } };

export type AcademicMajor = {
  id: string;
  schoolId: string;
  collegeId?: string | null;
  disciplineCategoryId?: string | null;
  disciplineLevelOneId?: string | null;
  disciplineLevelTwoId?: string | null;
  name: string;
  code?: string | null;
  educationLevel?: string | null;
  status: AcademicStatus;
  sortOrder: number;
  remark?: string | null;
  school?: AcademicSchool;
  college?: AcademicCollege | null;
  disciplineCategory?: DisciplineCategory | null;
  disciplineLevelOne?: DisciplineLevelOne | null;
  disciplineLevelTwo?: DisciplineLevelTwo | null;
};

export type DisciplineTree = {
  categories: DisciplineCategory[];
  levelOnes: DisciplineLevelOne[];
  levelTwos: DisciplineLevelTwo[];
};
