export interface WritingTaskContext {
  id: string;
  title: string;
  educationLevel: string;
  totalWordCount: number;
  topic: string;
  keywords: string[];
}

export interface WritingOutlineContext {
  outlineId: string;
  locked: boolean;
  lockedAt?: string | null;
  allChapterTitles: string[];
}

export interface WritingOutlineNode {
  id: string;
  parentId: string | null;
  title: string;
  summary: string | null;
  expectedWords: number;
  isLeaf: boolean;
  path: string;
  orderIndex: number;
}

export interface WritingPositionInfo {
  chapter: string;
  sectionIndex: number;
}

export interface SectionContext {
  task: WritingTaskContext;
  outline: WritingOutlineContext;
  currentNode: WritingOutlineNode;
  previousSummary: string | null;
  position: WritingPositionInfo;
  allChapterTitles: string[];
  temperature: number;
  maxTokens: number;
}
