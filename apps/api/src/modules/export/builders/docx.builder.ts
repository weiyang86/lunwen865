import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { ExportTemplate } from '@prisma/client';
import type { DocxSection } from './docx-builder.interface';
import { AbstractBuilder } from './abstract.builder';
import { ContentBuilder } from './content.builder';
import { CoverBuilder } from './cover.builder';
import { ReferenceBuilder } from './reference.builder';
import { RevisionBuilder } from './revision.builder';
import { TocBuilder } from './toc.builder';
import {
  TEMPLATE_CONFIGS,
  type DocxStyleConfig,
} from '../templates/template.config';
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

function buildSectionProperties(style: DocxStyleConfig) {
  const font = fontOf(style);
  const footers = style.showPageNumber
    ? {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: toHps(style.bodySize),
                  font,
                }),
              ],
            }),
          ],
        }),
      }
    : undefined;

  const headers = style.header
    ? {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: style.header,
                  size: toHps(style.bodySize),
                  font,
                }),
              ],
            }),
          ],
        }),
      }
    : undefined;

  return {
    page: {
      margin: {
        top: style.marginTop,
        bottom: style.marginBottom,
        left: style.marginLeft,
        right: style.marginRight,
      },
    },
    ...(footers ? { footers } : {}),
    ...(headers ? { headers } : {}),
  };
}

@Injectable()
export class DocxBuilder {
  constructor(
    private readonly cover: CoverBuilder,
    private readonly abstract: AbstractBuilder,
    private readonly toc: TocBuilder,
    private readonly content: ContentBuilder,
    private readonly reference: ReferenceBuilder,
    private readonly revision: RevisionBuilder,
  ) {}

  async build(
    snapshot: PaperSnapshot,
    template: ExportTemplate,
  ): Promise<Buffer> {
    const style =
      TEMPLATE_CONFIGS[String(template)] ?? TEMPLATE_CONFIGS.GENERIC;
    const sections: DocxSection[] = [];

    if (style.includeCover) sections.push(this.cover.build(snapshot, style));
    sections.push(this.abstract.build(snapshot, style));
    if (style.includeTOC) sections.push(this.toc.build(snapshot, style));
    sections.push(this.content.build(snapshot, style));
    if (snapshot.references?.length)
      sections.push(this.reference.build(snapshot, style));
    if (snapshot.revisions?.length)
      sections.push(this.revision.build(snapshot, style));

    const doc = new Document({
      creator: 'PaperGen',
      title: snapshot.title,
      styles: this.buildStyles(style),
      sections: sections.map((s) => ({
        properties: {
          ...(s.properties as object),
          ...buildSectionProperties(style),
        },
        children: s.children,
      })),
    });
    return Packer.toBuffer(doc);
  }

  private buildStyles(style: DocxStyleConfig) {
    const font = fontOf(style);
    return {
      default: {
        document: {
          run: { font, size: toHps(style.bodySize) },
          paragraph: { spacing: { line: style.lineHeight } },
        },
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font, size: toHps(style.titleSize), bold: true },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
          },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font, size: toHps(style.h1Size), bold: true },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font, size: toHps(style.h2Size), bold: true },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font, size: toHps(style.h3Size), bold: true },
          paragraph: { spacing: { before: 160, after: 80 } },
        },
      ],
    };
  }
}
