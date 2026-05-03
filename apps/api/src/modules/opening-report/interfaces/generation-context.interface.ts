export type AcademicLevel = 'UNDERGRADUATE' | 'MASTER' | 'DOCTOR';

export interface PreviousSection {
  key: string;
  title: string;
  summary: string;
}

export interface GenerationContext {
  topic: string;
  title: string;
  keywords: string[];
  academicLevel: AcademicLevel;
  language: string;
  previousSections: PreviousSection[];
  additionalRequirements?: string;
}
