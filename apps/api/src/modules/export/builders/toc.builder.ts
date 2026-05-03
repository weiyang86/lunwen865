import { Injectable } from '@nestjs/common';
import { Paragraph, TableOfContents, TextRun } from 'docx';
import type { IBuilder } from './docx-builder.interface';
import type { DocxStyleConfig } from '../templates/template.config';
import type { PaperSnapshot } from '../utils/snapshot.util';

function fontOf(style: DocxStyleConfig) {
  return {
    ascii: style.defaultFont,
    hAnsi: style.defaultFont,
    eastAsia: style.cnFont,
  };
}

function toHps(pt: number): number {
  return Math.round(pt * 2);
}

@Injectable()
export class TocBuilder implements IBuilder {
  build(_: PaperSnapshot, style: DocxStyleConfig) {
    const font = fontOf(style);
    const children: Paragraph[] = [];

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '目录',
            bold: true,
            size: toHps(style.h1Size),
            font,
          }),
        ],
      }),
    );

    children.push(
      new TableOfContents('目录', {
        hyperlink: true,
        headingStyleRange: '1-3',
      }) as unknown as Paragraph,
    );

    return { children };
  }
}
