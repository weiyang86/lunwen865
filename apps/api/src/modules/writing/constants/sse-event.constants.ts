export const WRITING_SSE_EVENTS = {
  SESSION_START: 'session.start',
  SECTION_START: 'section.start',
  SECTION_TOKEN: 'section.token',
  SECTION_COMPLETE: 'section.complete',
  SECTION_FAILED: 'section.failed',
  PROGRESS: 'progress',
  SESSION_COMPLETE: 'session.complete',
  SESSION_ERROR: 'session.error',
  HEARTBEAT: 'heartbeat',
} as const;
