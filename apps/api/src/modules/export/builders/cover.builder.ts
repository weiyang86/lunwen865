import { Injectable } from '@nestjs/common';
import { AlignmentType, PageBreak, Paragraph, TextRun } from 'docx';
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

function formatYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}年${m}月`;
}

@Injectable()
export class CoverBuilder implements IBuilder {
  build(snapshot: PaperSnapshot, style: DocxStyleConfig) {
    const font = fontOf(style);
    const lines: Array<[string, string | undefined]> = [
      ['学校', snapshot.school],
      ['专业', snapshot.major],
      ['学号', snapshot.studentId],
      ['姓名', snapshot.author],
      ['指导教师', snapshot.advisor],
      ['提交日期', formatYearMonth(new Date())],
    ];

    const children: Paragraph[] = [];
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [
          new TextRun({
            text: snapshot.title,
            bold: true,
            size: toHps(style.titleSize),
            font,
          }),
        ],
      }),
    );

    for (const [label, value] of lines) {
      if (!value) continue;
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: `${label}：`,
              bold: true,
              size: toHps(style.bodySize),
              font,
            }),
            new TextRun({ text: value, size: toHps(style.bodySize), font }),
          ],
        }),
      );
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));

    return { children };
  }
}
