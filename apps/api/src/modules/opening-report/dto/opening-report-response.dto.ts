export class OpeningReportSectionResponseDto {
  id!: string;
  reportId!: string;
  sectionKey!: string;
  sectionTitle!: string;
  sectionIndex!: number;
  status!: string;
  content!: string | null;
  wordCount!: number;
  durationMs!: number | null;
  generatedAt!: Date | null;
  errorMessage!: string | null;
  retryCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class OpeningReportResponseDto {
  id!: string;
  taskId!: string;
  status!: string;

  fullContent!: string | null;
  totalWordCount!: number;

  llmModel!: string | null;
  totalTokensUsed!: number;

  generationStartedAt!: Date | null;
  generationEndedAt!: Date | null;
  durationMs!: number | null;

  errorMessage!: string | null;
  retryCount!: number;

  createdAt!: Date;
  updatedAt!: Date;

  sections!: OpeningReportSectionResponseDto[];
}
