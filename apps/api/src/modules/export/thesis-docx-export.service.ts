import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import type { ThesisDocumentSection, ThesisFormatRule } from '@prisma/client';

type SectionNode = ThesisDocumentSection & { children?: SectionNode[] };
type ExportDocumentInput = {
  title: string;
  abstract?: string | null;
  keywords?: unknown;
  sections: SectionNode[];
  rules: ThesisFormatRule[];
};

type StyleHints = {
  bodyFont: string;
  bodySize: number;
  headingFont: string;
  heading1Size: number;
  heading2Size: number;
  lineSpacing: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberOf(value: unknown, fallback: number) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toHps(pt: number) {
  return Math.round(pt * 2);
}

function normalizeText(content?: string | null) {
  return (content ?? '').replace(/\r\n/g, '\n').replace(/<[^>]+>/g, '');
}

@Injectable()
export class ThesisDocxExportService {
  async build(input: ExportDocumentInput): Promise<Buffer> {
    const style = this.styleFromRules(input.rules);
    const children: Paragraph[] = [];
    children.push(
      new Paragraph({
        text: input.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
    );

    if (input.abstract) {
      children.push(this.heading('摘要', 1, style));
      children.push(...this.textParagraphs(input.abstract, style));
    }
    const keywords = this.keywordsText(input.keywords);
    if (keywords) {
      children.push(this.heading('关键词', 1, style));
      children.push(this.body(`关键词：${keywords}`, style));
    }

    const toc = this.flatten(input.sections).filter(
      (s) => !['TITLE', 'ABSTRACT', 'KEYWORDS'].includes(s.sectionType),
    );
    if (toc.length) {
      children.push(this.heading('目录', 1, style));
      for (const section of toc)
        children.push(
          this.body(
            `${'  '.repeat(Math.max(0, section.level - 1))}${section.title}`,
            style,
          ),
        );
    }

    for (const section of input.sections)
      this.appendSection(children, section, style);

    const doc = new Document({
      creator: '论文通',
      title: input.title,
      styles: {
        default: {
          document: {
            run: {
              font: {
                eastAsia: style.bodyFont,
                ascii: 'Times New Roman',
                hAnsi: 'Times New Roman',
              },
              size: toHps(style.bodySize),
            },
            paragraph: {
              spacing: { line: Math.round(style.lineSpacing * 240) },
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
            },
          },
          children,
        },
      ],
    });
    return Packer.toBuffer(doc);
  }

  private appendSection(
    out: Paragraph[],
    section: SectionNode,
    style: StyleHints,
  ) {
    if (['TITLE', 'ABSTRACT', 'KEYWORDS'].includes(section.sectionType)) return;
    out.push(this.heading(section.title, section.level, style));
    out.push(...this.textParagraphs(section.content, style));
    for (const child of section.children ?? [])
      this.appendSection(out, child, style);
  }

  private textParagraphs(
    content: string | null | undefined,
    style: StyleHints,
  ) {
    const text = normalizeText(content);
    if (!text.trim()) return [this.body('', style)];
    return text.split('\n').map((line) => this.body(line, style));
  }

  private heading(text: string, level: number, style: StyleHints) {
    const size = level <= 1 ? style.heading1Size : style.heading2Size;
    return new Paragraph({
      heading: level <= 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 160 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: toHps(size),
          font: {
            eastAsia: style.headingFont,
            ascii: 'Times New Roman',
            hAnsi: 'Times New Roman',
          },
        }),
      ],
    });
  }

  private body(text: string, style: StyleHints) {
    return new Paragraph({
      spacing: { line: Math.round(style.lineSpacing * 240), after: 120 },
      children: [
        new TextRun({
          text,
          size: toHps(style.bodySize),
          font: {
            eastAsia: style.bodyFont,
            ascii: 'Times New Roman',
            hAnsi: 'Times New Roman',
          },
        }),
      ],
    });
  }

  private flatten(sections: SectionNode[]): SectionNode[] {
    return sections.flatMap((s) => [s, ...this.flatten(s.children ?? [])]);
  }

  private keywordsText(value: unknown) {
    if (Array.isArray(value))
      return value.map(String).filter(Boolean).join('；');
    if (typeof value === 'string') return value;
    const obj = asRecord(value);
    if (Array.isArray(obj.items))
      return obj.items.map(String).filter(Boolean).join('；');
    return '';
  }

  private styleFromRules(rules: ThesisFormatRule[]): StyleHints {
    const get = (key: string) =>
      rules.find((r) => r.ruleKey === key)?.ruleValue;
    const body = asRecord(get('body'));
    const heading = asRecord(get('heading'));
    return {
      bodyFont: textOf(body.fontFamily) || '宋体',
      bodySize: numberOf(body.fontSize, 12),
      headingFont: textOf(heading.heading1FontFamily) || '黑体',
      heading1Size: numberOf(heading.heading1FontSize, 16),
      heading2Size: numberOf(heading.heading2FontSize, 14),
      lineSpacing: numberOf(body.lineSpacing, 1.5),
    };
  }
}
