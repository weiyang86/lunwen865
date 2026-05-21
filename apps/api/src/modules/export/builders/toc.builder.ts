import { Injectable } from '@nestjs/common';
import { Paragraph, TextRun } from 'docx';
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
  build(snapshot: PaperSnapshot, style: DocxStyleConfig) {
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

    const lines: Array<{ level: 1 | 2 | 3; text: string }> = [];
    const walk = (nodes: PaperSnapshot['outline'], level: 1 | 2 | 3) => {
      for (const n of nodes ?? []) {
        const prefix = n.number ? `${n.number} ` : '';
        lines.push({ level, text: `${prefix}${n.title}`.trim() });
        if (n.children?.length) {
          const nextLevel: 1 | 2 | 3 = level === 1 ? 2 : 3;
          walk(n.children, nextLevel);
        }
      }
    };
    walk(snapshot.outline ?? [], 1);

    if (!lines.length) {
      children.push(
        new Paragraph({
          spacing: { line: style.lineHeight },
          children: [
            new TextRun({
              text: '（未生成目录大纲，可在“目录/大纲”生成并锁定后再导出）',
              size: toHps(style.bodySize),
              font,
            }),
          ],
        }),
      );
    } else {
      for (const l of lines) {
        children.push(
          new Paragraph({
            indent: { left: l.level === 1 ? 0 : l.level === 2 ? 400 : 800 },
            spacing: { line: style.lineHeight },
            children: [
              new TextRun({
                text: l.text,
                size: toHps(style.bodySize),
                font,
              }),
            ],
          }),
        );
      }
    }

    return { children };
  }
}
