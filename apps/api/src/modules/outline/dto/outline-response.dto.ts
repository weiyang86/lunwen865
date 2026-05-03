export class OutlineNodeResponseDto {
  id!: string;
  outlineId!: string;
  parentId!: string | null;

  nodeType!: string;
  depth!: number;
  orderIndex!: number;
  path!: string;

  title!: string;
  summary!: string | null;
  expectedWords!: number;
  isLeaf!: boolean;

  numbering!: string | null;

  createdAt!: Date;
  updatedAt!: Date;

  children!: OutlineNodeResponseDto[];
}

export class OutlineResponseDto {
  id!: string;
  taskId!: string;
  status!: string;
  locked!: boolean;
  lockedAt!: Date | null;

  totalWordCount!: number;
  targetWordCount!: number;
  maxDepth!: number;

  llmModel!: string | null;
  totalTokensUsed!: number;
  generationDurationMs!: number | null;

  version!: number;
  createdAt!: Date;
  updatedAt!: Date;

  nodes!: OutlineNodeResponseDto[];
}
