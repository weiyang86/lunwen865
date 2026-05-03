export class FullDocumentSectionDto {
  id!: string;
  orderIndex!: number;
  title!: string;
  content!: string;
  wordCount!: number;
}

export class FullDocumentReferenceDto {
  index!: number;
  key!: string;
  placeholder!: string;
}

export class FullDocumentDto {
  taskId!: string;
  sessionId!: string;
  totalWords!: number;
  sections!: FullDocumentSectionDto[];
  references!: FullDocumentReferenceDto[];
}
