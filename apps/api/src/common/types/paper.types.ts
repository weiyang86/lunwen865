export interface SchoolTemplateFormatConfig {
  fonts?: {
    body?: string;
    english?: string;
    headings?: Record<string, string>;
  };
  fontSize?: {
    body?: number;
    headings?: Record<string, number>;
  };
  lineSpacing?: number;
  margins?: {
    topMm?: number;
    rightMm?: number;
    bottomMm?: number;
    leftMm?: number;
  };
  sections?: Array<{
    key: string;
    title: string;
    minWords?: number;
    maxWords?: number;
    required?: boolean;
  }>;
  citation?: {
    style?: string;
    requireReferences?: boolean;
  };
  extra?: Record<string, unknown>;
}

export interface OpeningReportReferenceItem {
  title: string;
  authors?: string[];
  year?: number;
  source?: string;
  url?: string;
  doi?: string;
}

export interface OpeningReportScheduleItem {
  phase: string;
  start?: string;
  end?: string;
  deliverable?: string;
}

export interface OpeningReportContent {
  researchBackground: string;
  researchSignificance: string;
  literatureReview: string;
  researchMethods: string[] | string;
  researchContent: string;
  schedule: OpeningReportScheduleItem[];
  references: OpeningReportReferenceItem[];
  extra?: Record<string, unknown>;
}

export interface OutlineSectionNode {
  index: number;
  title: string;
  targetWordCount?: number;
  corePoints?: string[];
  notes?: string;
}

export interface OutlineChapterNode {
  index: number;
  title: string;
  targetWordCount?: number;
  corePoints?: string[];
  sections?: OutlineSectionNode[];
  notes?: string;
}

export interface OutlineStructure {
  chapters: OutlineChapterNode[];
  totalWordCount?: number;
  extra?: Record<string, unknown>;
}

export interface PaperMemoryChapterSummaryItem {
  title: string;
  summary: string;
  keyPoints?: string[];
  actualWordCount?: number;
}

export type PaperMemoryChapterSummaries = Record<
  string,
  PaperMemoryChapterSummaryItem
>;

export interface PaperMemoryGlobalContext {
  writingStyle?: string;
  citationStyle?: string;
  constraints?: {
    avoid?: string[];
    mustInclude?: string[];
  };
  major?: string;
  educationLevel?: string;
  keywords?: string[];
  extra?: Record<string, unknown>;
}
