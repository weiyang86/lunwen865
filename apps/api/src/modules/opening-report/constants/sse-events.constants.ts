export const SSE_EVENTS = {
  START: 'start',
  SECTION_START: 'section_start',
  SECTION_DELTA: 'section_delta',
  SECTION_END: 'section_end',
  PROGRESS: 'progress',
  DONE: 'done',
  ERROR: 'error',
  HEARTBEAT: 'heartbeat',
} as const;

export type SseEventName = (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS];
