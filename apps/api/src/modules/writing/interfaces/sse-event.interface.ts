import type { WRITING_SSE_EVENTS } from '../constants/sse-event.constants';

type WritingSseEventName =
  (typeof WRITING_SSE_EVENTS)[keyof typeof WRITING_SSE_EVENTS];

export type WritingSseEvent =
  | {
      event: typeof WRITING_SSE_EVENTS.SESSION_START;
      data: { sessionId: string; totalSections: number };
    }
  | {
      event: typeof WRITING_SSE_EVENTS.SECTION_START;
      data: {
        sectionId: string;
        nodeId: string;
        title: string;
        index: number;
        total: number;
      };
    }
  | {
      event: typeof WRITING_SSE_EVENTS.SECTION_TOKEN;
      data: { sectionId: string; token: string };
    }
  | {
      event: typeof WRITING_SSE_EVENTS.SECTION_COMPLETE;
      data: { sectionId: string; wordCount: number };
    }
  | {
      event: typeof WRITING_SSE_EVENTS.SECTION_FAILED;
      data: { sectionId: string; error: string; retryable: boolean };
    }
  | {
      event: typeof WRITING_SSE_EVENTS.PROGRESS;
      data: { completed: number; total: number; percentage: number };
    }
  | {
      event: typeof WRITING_SSE_EVENTS.SESSION_COMPLETE;
      data: { sessionId: string };
    }
  | {
      event: typeof WRITING_SSE_EVENTS.SESSION_ERROR;
      data: { error: string; recoverable: boolean };
    }
  | {
      event: typeof WRITING_SSE_EVENTS.HEARTBEAT;
      data: { ts: number };
    };

export type WritingSseEventType = WritingSseEventName;
