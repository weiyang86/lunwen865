import { ExportTemplate } from '@prisma/client';
import PizZip from 'pizzip';
import { AbstractBuilder } from './abstract.builder';
import { ContentBuilder } from './content.builder';
import { CoverBuilder } from './cover.builder';
import { DocxBuilder } from './docx.builder';
import { ReferenceBuilder } from './reference.builder';
import { RevisionBuilder } from './revision.builder';
import { TocBuilder } from './toc.builder';
import type { PaperSnapshot } from '../utils/snapshot.util';

describe('DocxBuilder', () => {
  const builder = new DocxBuilder(
    new CoverBuilder(),
    new AbstractBuilder(),
    new TocBuilder(),
    new ContentBuilder(),
    new ReferenceBuilder(),
    new RevisionBuilder(),
  );

  function baseSnapshot(): PaperSnapshot {
    return {
      title: '测试论文标题',
      author: '测试作者',
      school: '测试大学',
      major: '计算机科学与技术',
      studentId: '20260001',
      advisor: '测试导师',
      abstract: '摘要内容',
      keywords: ['k1', 'k2'],
      outline: [{ level: 1, number: '1', title: '绪论' }],
      sections: [
        {
          level: 1,
          number: '1',
          title: '绪论',
          paragraphs: ['这是一个段落，包含独特标记：测试XYZ123。'],
        },
      ],
      references: [{ index: 1, text: 'Author A. Title A. 2024.' }],
    };
  }

  it('三套模板均能成功生成 Buffer，长度 > 1KB', async () => {
    const snapshot = baseSnapshot();
    const templates = [
      ExportTemplate.GENERIC,
      ExportTemplate.UNDERGRADUATE,
      ExportTemplate.MASTER,
    ];
    for (const t of templates) {
      const buf = await builder.build(snapshot, t);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(1024);
    }
  });

  it('docx 解压后 document.xml 含独特文字', async () => {
    const snapshot = baseSnapshot();
    const buf = await builder.build(snapshot, ExportTemplate.GENERIC);
    const zip = new PizZip(buf);
    const xml = zip.file('word/document.xml')?.asText() ?? '';
    expect(xml).toContain('测试XYZ123');
  });

  it('WITH_REVISIONS 模式生成的 buffer > 普通模式', async () => {
    const normal = baseSnapshot();
    const withRev: PaperSnapshot = {
      ...baseSnapshot(),
      revisions: [
        {
          sectionTitle: '绪论',
          original: '原文',
          revised: '新文',
          comment: '注释',
        },
      ],
    };

    const buf1 = await builder.build(normal, ExportTemplate.GENERIC);
    const buf2 = await builder.build(withRev, ExportTemplate.GENERIC);
    expect(buf2.length).toBeGreaterThan(buf1.length);
  });

  it('OUTLINE_ONLY 模式 sections 为空也能生成', async () => {
    const snapshot: PaperSnapshot = {
      ...baseSnapshot(),
      sections: [],
      outline: [
        { level: 1, number: '1', title: '绪论' },
        { level: 2, number: '1.1', title: '背景' },
      ],
      references: [],
    };

    const buf = await builder.build(snapshot, ExportTemplate.GENERIC);
    expect(buf.length).toBeGreaterThan(1024);
  });
});
