export type OnlyOfficeCallbackBody = {
  key?: string;
  status?: number;
  url?: string;
  users?: string[];
  token?: string;
  history?: unknown;
  changesurl?: string;
  filetype?: string;
  forcesavetype?: number;
  userdata?: string;
  error?: number;
};

export type OnlyOfficeJwtPayload = Record<string, unknown> & {
  iat?: number;
  exp?: number;
};
