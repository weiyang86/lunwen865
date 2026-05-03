export type SseEvent =
  | {
      event: 'start';
      data: {
        reportId: string;
        totalSections: number;
        sections: Array<{ key: string; title: string; index: number }>;
      };
    }
  | {
      event: 'section_start';
      data: { sectionKey: string; sectionIndex: number; sectionTitle: string };
    }
  | { event: 'section_delta'; data: { sectionKey: string; delta: string } }
  | {
      event: 'section_end';
      data: {
        sectionKey: string;
        sectionIndex: number;
        content: string;
        wordCount: number;
        skipped?: boolean;
      };
    }
  | {
      event: 'progress';
      data: {
        overallPercent: number;
        currentSection: string;
        sectionPercent: number;
        completedSections: number;
        totalSections: number;
      };
    }
  | {
      event: 'done';
      data: { reportId: string; totalWordCount: number; durationMs: number };
    }
  | {
      event: 'error';
      data: {
        sectionKey?: string;
        code: string;
        message: string;
        recoverable: boolean;
        failedSections?: string[];
      };
    }
  | { event: 'heartbeat'; data: { ts: number } };
