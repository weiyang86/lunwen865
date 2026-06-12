export type ThesisSkillStage = 'TOPIC' | 'PROPOSAL' | 'OUTLINE' | 'FULL_PAPER' | 'REVISION' | 'POLISHING' | 'FORMAT_CHECK' | 'REFERENCE' | 'ABSTRACT' | 'DEFENSE';
export type ThesisSkillCategory = 'GENERATION' | 'REVISION' | 'CHECK' | 'EXPORT_ASSIST';
export type ThesisSkillStatus = 'ENABLED' | 'DISABLED';
export type ThesisSkillRunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export type PageResp<T> = { list: T[]; total: number; page: number; pageSize: number };

export type ThesisSkillVersion = {
  id: string;
  skillId: string;
  version: number;
  promptTemplate: string;
  inputSchema: unknown;
  outputSchema: unknown;
  qualityRules: unknown;
  modelConfig: unknown;
  isActive: boolean;
  changeLog?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ThesisSkill = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  stage: ThesisSkillStage;
  category: ThesisSkillCategory;
  status: ThesisSkillStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  versions?: ThesisSkillVersion[];
  bindings?: ThesisSkillBinding[];
};

export type ThesisSkillBinding = {
  id: string;
  skillId: string;
  skillVersionId?: string | null;
  educationLevel?: string | null;
  thesisType?: string | null;
  disciplineCategoryId?: string | null;
  disciplineLevelOneId?: string | null;
  disciplineLevelTwoId?: string | null;
  schoolId?: string | null;
  majorId?: string | null;
  priority: number;
  status: ThesisSkillStatus;
  school?: { name: string } | null;
  major?: { name: string } | null;
  disciplineCategory?: { name: string } | null;
  disciplineLevelOne?: { name: string } | null;
  disciplineLevelTwo?: { name: string } | null;
  skillVersion?: ThesisSkillVersion | null;
};

export type ThesisSkillRun = {
  id: string;
  skillId: string;
  skillVersionId: string;
  bindingId?: string | null;
  taskId?: string | null;
  stage: ThesisSkillStage;
  inputPayload: unknown;
  outputPayload?: unknown;
  qualityResult?: unknown;
  modelName?: string | null;
  tokenUsage?: unknown;
  status: ThesisSkillRunStatus;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  skill?: ThesisSkill;
  skillVersion?: ThesisSkillVersion;
  binding?: ThesisSkillBinding | null;
};
