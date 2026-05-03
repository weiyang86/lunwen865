export interface ReferenceItem {
  key: string;
  index: number;
  placeholder: string;
}

export interface ResolvedSection {
  id: string;
  resolvedContent: string;
}

export interface ResolveAllResult {
  resolvedSections: ResolvedSection[];
  references: ReferenceItem[];
}
