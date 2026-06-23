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

export type AcademicRegionLevel = 'PROVINCE' | 'CITY' | 'DISTRICT';
export type AcademicRegionStatus = 'ACTIVE' | 'DISABLED';

export type AcademicRegion = {
  id?: string;
  code: string;
  name: string;
  level: AcademicRegionLevel;
  parentCode?: string | null;
  status?: AcademicRegionStatus;
  sortOrder: number;
  source?: 'AMAP' | 'MANUAL';
  lastSyncedAt?: string | null;
};

export type RegionSyncPreview = {
  total: number;
  createCount: number;
  updateCount: number;
  warningCount: number;
  samples: AcademicRegion[];
  errors: { code: string; message: string }[];
  apiKeyConfigured: boolean;
  mock: boolean;
};

export type RegionSyncStatus = {
  apiKeyConfigured: boolean;
  mock: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  status: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';
};

export type AcademicSyncLog = {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  detail?: unknown;
  createdAt: string;
  job?: { name: string; type: 'REGION_AMAP'; status: string } | null;
};

export type SchoolImportError = { rowNumber: number; field: string; message: string; rawValue?: string };
export type SchoolImportPreviewRow = {
  rowNumber: number;
  provinceCode: string;
  cityCode: string;
  name: string;
  code: string;
  schoolType: string;
  educationLevels: string[];
  schoolCode?: string;
  schoolName?: string;
  collegeName?: string | null;
  majorCode?: string;
  majorName?: string;
  educationLevel?: string;
  programCode?: string;
  programName?: string;
  degreeLevel?: string;
  status: 'ACTIVE' | 'INACTIVE';
  source: string;
  confidence: number;
  mode: 'create' | 'update';
};
export type SchoolImportPreview = {
  previewId: string;
  totalRows: number;
  validRows: number;
  createRows: number;
  updateRows: number;
  errorRows: number;
  duplicateRows: number;
  warnings: string[];
  sampleRows: SchoolImportPreviewRow[];
  errors: SchoolImportError[];
};
export type SchoolImportConfirmResult = { previewId: string; successRows: number; createRows: number; updateRows: number; failedRows: number };
