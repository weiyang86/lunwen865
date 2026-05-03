import { Injectable } from '@nestjs/common';
import { HeadingLevel, Paragraph, TextRun } from 'docx';
import type { IBuilder } from './docx-builder.interface';
import type { DocxStyleConfig } from '../templates/template.config';
import type { PaperSnapshot, SectionContent } from '../utils/snapshot.util';

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

function headingOf(level: 1 | 2 | 3) {
  if (level === 1) return HeadingLevel.HEADING_1;
  if (level === 2) return HeadingLevel.HEADING_2;
  return HeadingLevel.HEADING_3;
}

function unwrapFormula(text: string): { text: string; italic: boolean } {
  const t = text.trim();
  if (t.startsWith('...') && t.endsWith('...') && t.length >= 6) {
    return { text: t.slice(3, -3).trim(), italic: true };
  }
  return { text, italic: false };
}

function buildSectionTitle(sec: SectionContent): string {
  const prefix = sec.number ? `${sec.number} ` : '';
  return `${prefix}${sec.title}`.trim();
}

@Injectable()
export class ContentBuilder implements IBuilder {
  build(snapshot: PaperSnapshot, style: DocxStyleConfig) {
    const font = fontOf(style);
    const children: Paragraph[] = [];

    for (const sec of snapshot.sections ?? []) {
      children.push(
        new Paragraph({
          heading: headingOf(sec.level),
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: buildSectionTitle(sec),
              bold: true,
              size: toHps(
                sec.level === 1
                  ? style.h1Size
                  : sec.level === 2
                    ? style.h2Size
                    : style.h3Size,
              ),
              font,
            }),
          ],
        }),
      );

      for (const p of sec.paragraphs ?? []) {
        const { text, italic } = unwrapFormula(p);
        const trimmed = text.trim();
        if (!trimmed) continue;

        children.push(
          new Paragraph({
            indent: { firstLine: style.firstLineIndent },
            spacing: { line: style.lineHeight },
            children: [
              new TextRun({
                text: trimmed,
                italics: italic,
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
