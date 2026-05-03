export interface WordAllocationLeafInput {
  id: string;
  expectedWords: number;
}

export interface WordCountValidationResult {
  valid: boolean;
  reason?: string;
}
