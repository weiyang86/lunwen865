import { Injectable } from '@nestjs/common';
import { HeadingLevel, Paragraph, TextRun } from 'docx';
import type { IBuilder } from './docx-builder.interface';
import type { DocxStyleConfig } from '../templates/template.config';
import type { PaperSnapshot, RevisionPair } from '../utils/snapshot.util';

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

function groupBySectionTitle(revisions: RevisionPair[]) {
  const map = new Map<string, RevisionPair[]>();
  for (const r of revisions) {
    const key = r.sectionTitle || '未命名';
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return map;
}

@Injectable()
export class RevisionBuilder implements IBuilder {
  build(snapshot: PaperSnapshot, style: DocxStyleConfig) {
    const font = fontOf(style);
    const revs = snapshot.revisions ?? [];
    const children: Paragraph[] = [];

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: '修订对比',
            bold: true,
            size: toHps(style.h1Size),
            font,
          }),
        ],
      }),
    );

    const groups = groupBySectionTitle(revs);
    for (const [title, items] of groups.entries()) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: title,
              bold: true,
              size: toHps(style.h2Size),
              font,
            }),
          ],
        }),
      );

      for (const item of items) {
        children.push(
          new Paragraph({
            spacing: { line: style.lineHeight },
            children: [
              new TextRun({
                text: item.original,
                strike: true,
                color: '000000',
                size: toHps(style.bodySize),
                font,
              }),
            ],
          }),
        );
        children.push(
          new Paragraph({
            spacing: { line: style.lineHeight },
            children: [
              new TextRun({
                text: item.revised,
                color: '0000FF',
                size: toHps(style.bodySize),
                font,
              }),
            ],
          }),
        );

        if (item.comment) {
          children.push(
            new Paragraph({
              spacing: { line: style.lineHeight },
              children: [
                new TextRun({
                  text: item.comment,
                  color: '808080',
                  size: toHps(Math.max(style.bodySize - 2, 8)),
                  italics: true,
                  font,
                }),
              ],
            }),
          );
        }
      }
    }

    return { children };
  }
}
