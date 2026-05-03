import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ExportTemplate } from '@prisma/client';
import { DocxBuilder } from '../apps/api/src/modules/export/builders/docx.builder';
import { AbstractBuilder } from '../apps/api/src/modules/export/builders/abstract.builder';
import { ContentBuilder } from '../apps/api/src/modules/export/builders/content.builder';
import { CoverBuilder } from '../apps/api/src/modules/export/builders/cover.builder';
import { ReferenceBuilder } from '../apps/api/src/modules/export/builders/reference.builder';
import { RevisionBuilder } from '../apps/api/src/modules/export/builders/revision.builder';
import { TocBuilder } from '../apps/api/src/modules/export/builders/toc.builder';
import type { PaperSnapshot } from '../apps/api/src/modules/export/utils/snapshot.util';

async function main() {
  const outDir = join(process.cwd(), 'tmp', 'export-docx');
  await mkdir(outDir, { recursive: true });

  const snapshot: PaperSnapshot = {
    title: '示例论文标题',
    author: '测试用户',
    school: '示例大学',
    major: '计算机科学与技术',
    studentId: '20260001',
    advisor: '张老师',
    abstract:
      '本文围绕论文生成系统的关键问题展开研究，重点讨论生成式模型在学术写作流程中的应用边界与风险控制。',
    keywords: ['生成式模型', '学术写作', '系统设计'],
    abstractEn:
      'This paper investigates the key issues of paper generation systems and discusses boundary conditions and risk controls in academic writing workflows.',
    keywordsEn: ['generative models', 'academic writing', 'system design'],
    outline: [
      { level: 1, number: '1', title: '绪论' },
      { level: 1, number: '2', title: '相关工作' },
      { level: 1, number: '3', title: '方法' },
    ],
    sections: [
      {
        level: 1,
        number: '1',
        title: '绪论',
        paragraphs: [
          '本文提出一种面向论文生成的流程化架构，用于提升写作一致性与可控性。',
          '...E=mc^2...',
        ],
      },
      {
        level: 2,
        number: '1.1',
        title: '研究背景',
        paragraphs: [
          '随着大模型能力提升，学术写作辅助成为重要应用方向，但也带来合规与检测风险。',
        ],
      },
      {
        level: 3,
        number: '1.1.1',
        title: '问题定义',
        paragraphs: ['我们关注文本生成的可控性、可追溯性与格式规范。'],
      },
    ],
    references: [
      { index: 1, text: 'Author A. Title A. 2024.' },
      { index: 2, text: 'Author B. Title B. 2023.' },
    ],
    revisions: [
      {
        sectionTitle: '绪论',
        original: '原文示例段落。',
        revised: '改写后示例段落。',
        comment: '保持语义一致，降低重复句式。',
      },
    ],
  };

  const builder = new DocxBuilder(
    new CoverBuilder(),
    new AbstractBuilder(),
    new TocBuilder(),
    new ContentBuilder(),
    new ReferenceBuilder(),
    new RevisionBuilder(),
  );

  const templates: ExportTemplate[] = [
    ExportTemplate.GENERIC,
    ExportTemplate.UNDERGRADUATE,
    ExportTemplate.MASTER,
  ];

  for (const t of templates) {
    const buf = await builder.build(snapshot, t);
    const file = join(outDir, `export_${t}.docx`);
    await writeFile(file, buf);
    console.log(`written: ${file}`);
  }
}

void main();

