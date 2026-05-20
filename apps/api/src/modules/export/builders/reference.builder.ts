import { Injectable } from '@nestjs/common';
import { HeadingLevel, Paragraph, TextRun } from 'docx';
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
export class ReferenceBuilder implements IBuilder {
  build(snapshot: PaperSnapshot, style: DocxStyleConfig) {
    const font = fontOf(style);
    const refs = [...(snapshot.references ?? [])].sort(
      (a, b) => a.index - b.index,
    );
    const children: Paragraph[] = [];

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: '参考文献',
            bold: true,
            size: toHps(style.h1Size),
            font,
          }),
        ],
      }),
    );

    if (refs.length === 0) {
      children.push(
        new Paragraph({
          spacing: { line: style.lineHeight },
          children: [
            new TextRun({
              text: '（未生成参考文献，可在“正文生成”点击“生成参考文献”后再导出）',
              size: toHps(style.bodySize),
              font,
            }),
          ],
        }),
      );
    }

    for (const r of refs) {
      children.push(
        new Paragraph({
          indent: { left: 600, hanging: 400 },
          spacing: { line: style.lineHeight },
          children: [
            new TextRun({
              text: `[${r.index}] ${r.text}`,
              size: toHps(style.bodySize),
              font,
            }),
          ],
        }),
      );
    }

    return { children };
  }
}
