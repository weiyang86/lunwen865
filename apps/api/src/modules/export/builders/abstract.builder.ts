import { Injectable } from '@nestjs/common';
import {
  HeadingLevel,
  PageBreak,
  Paragraph,
  TextRun,
  UnderlineType,
} from 'docx';
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
export class AbstractBuilder implements IBuilder {
  build(snapshot: PaperSnapshot, style: DocxStyleConfig) {
    const font = fontOf(style);
    const children: Paragraph[] = [];

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: '摘要',
            bold: true,
            size: toHps(style.h1Size),
            font,
          }),
        ],
      }),
    );

    for (const p of snapshot.abstract
      ? snapshot.abstract.split(/\n{2,}/g)
      : []) {
      const text = p.trim();
      if (!text) continue;
      children.push(
        new Paragraph({
          indent: { firstLine: style.firstLineIndent },
          spacing: { line: style.lineHeight },
          children: [new TextRun({ text, size: toHps(style.bodySize), font })],
        }),
      );
    }

    const keywords = snapshot.keywords?.filter(Boolean) ?? [];
    if (keywords.length > 0) {
      children.push(
        new Paragraph({
          indent: { firstLine: style.firstLineIndent },
          spacing: { line: style.lineHeight },
          children: [
            new TextRun({
              text: '关键词：',
              bold: true,
              size: toHps(style.bodySize),
              font,
            }),
            new TextRun({
              text: keywords.join('，'),
              size: toHps(style.bodySize),
              font,
            }),
          ],
        }),
      );
    }

    if (snapshot.abstractEn) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [
            new TextRun({
              text: 'Abstract',
              bold: true,
              underline: { type: UnderlineType.SINGLE },
              size: toHps(style.h1Size),
              font,
            }),
          ],
        }),
      );

      for (const p of snapshot.abstractEn.split(/\n{2,}/g)) {
        const text = p.trim();
        if (!text) continue;
        children.push(
          new Paragraph({
            spacing: { line: style.lineHeight },
            children: [
              new TextRun({ text, size: toHps(style.bodySize), font }),
            ],
          }),
        );
      }

      const keywordsEn = snapshot.keywordsEn?.filter(Boolean) ?? [];
      if (keywordsEn.length > 0) {
        children.push(
          new Paragraph({
            spacing: { line: style.lineHeight },
            children: [
              new TextRun({
                text: 'Keywords: ',
                bold: true,
                size: toHps(style.bodySize),
                font,
              }),
              new TextRun({
                text: keywordsEn.join(', '),
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
