export interface StreamCallbacks {
  onSectionDelta?: (params: { sectionKey: string; delta: string }) => void;
  onSectionProgress?: (params: {
    sectionKey: string;
    sectionPercent: number;
  }) => void;
  onOverallProgress?: (params: {
    overallPercent: number;
    currentSection: string;
    completedSections: number;
    totalSections: number;
  }) => void;
}
