import type { ExportScope, ExportStatus, ExportTemplate } from '@prisma/client';

export class ExportResultDto {
  id: string;
  title: string;
  paperId: string | null;
  polishTaskId: string | null;
  scope: ExportScope;
  template: ExportTemplate;
  status: ExportStatus;
  progress: number;
  fileName: string | null;
  fileSize: number | null;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  errorMessage: string | null;
}
