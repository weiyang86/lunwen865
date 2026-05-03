import type { ExportStatus } from '@prisma/client';

export class ExportResultDto {
  id: string;
  status: ExportStatus;
  progress: number;
  fileName: string | null;
  fileSize: number | null;
  downloadCount: number;
  createdAt: Date;
  expiresAt: Date | null;
  errorMessage: string | null;
}
