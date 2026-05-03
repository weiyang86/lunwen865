import type { Paragraph, Table } from 'docx';
import type { PaperSnapshot } from '../utils/snapshot.util';
import type { DocxStyleConfig } from '../templates/template.config';

export interface DocxSection {
  properties?: unknown;
  children: (Paragraph | Table)[];
}

export interface IBuilder {
  build(snapshot: PaperSnapshot, style: DocxStyleConfig): DocxSection;
}
