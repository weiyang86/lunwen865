/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { NotFoundException } from '@nestjs/common';
import { AcademicDisciplineCatalogLevel } from '@prisma/client';
import { CatalogImportService } from './catalog-import.service';

function csv(content: string) {
  return {
    originalname: 'catalog.csv',
    mimetype: 'text/csv',
    buffer: Buffer.from(content, 'utf8'),
  };
}
function prismaMock(
  existingMajor: string[] = [],
  existingDiscipline: string[] = [],
) {
  return {
    academicCatalogMajor: {
      findMany: jest
        .fn()
        .mockResolvedValue(existingMajor.map((code) => ({ code }))),
      upsert: jest.fn(),
    },
    academicDisciplineCatalog: {
      findMany: jest
        .fn()
        .mockResolvedValue(existingDiscipline.map((code) => ({ code }))),
      upsert: jest.fn(),
    },
    academicSyncLog: { create: jest.fn() },
    $transaction: jest.fn(),
  } as any;
}

describe('CatalogImportService', () => {
  it('previews major template rows', async () => {
    const prisma = prismaMock();
    const service = new CatalogImportService(prisma);
    const report = await service.previewMajors(
      csv(
        'code,name,categoryCode,categoryName,disciplineCode,disciplineName,educationLevel,degree,years,status,version,source,sourceVersion,sourceUrl,confidence,remark\n080901,计算机科学与技术,0809,计算机类,08,工学,UNDERGRADUATE,工学,4,ACTIVE,2025,MOE,2025,,100,\n',
      ),
    );
    expect(report).toMatchObject({
      totalRows: 1,
      validRows: 1,
      createRows: 1,
      errorRows: 0,
    });
    expect(prisma.academicCatalogMajor.upsert).not.toHaveBeenCalled();
  });

  it('marks existing major code as update and confirms via upsert', async () => {
    const prisma = prismaMock(['080901']);
    const service = new CatalogImportService(prisma);
    const report = await service.previewMajors(
      csv(
        'code,name,categoryCode,categoryName,disciplineCode,disciplineName,educationLevel,degree,years,status,version,source,sourceVersion,sourceUrl,confidence,remark\n080901,计算机科学与技术,0809,计算机类,08,工学,UNDERGRADUATE,工学,4,ACTIVE,2025,MOE,2025,,100,\n',
      ),
    );
    expect(report.updateRows).toBe(1);
    await service.confirmMajors(report.previewId);
    expect(prisma.academicCatalogMajor.upsert).toHaveBeenCalledTimes(1);
  });

  it('validates discipline parentCode against current file or database', async () => {
    const service = new CatalogImportService(prismaMock());
    const report = await service.previewDisciplines(
      csv(
        'code,name,parentCode,level,type,educationLevels,status,version,source,sourceVersion,sourceUrl,confidence,remark\n0812,计算机科学与技术,99,FIRST_LEVEL_DISCIPLINE,ACADEMIC,"MASTER,DOCTOR",ACTIVE,2022,MOE,2022,,100,\n',
      ),
    );
    expect(report.errors.map((e) => e.field)).toContain('parentCode');
  });

  it('previews discipline rows with parent in same file', async () => {
    const service = new CatalogImportService(prismaMock());
    const report = await service.previewDisciplines(
      csv(
        'code,name,parentCode,level,type,educationLevels,status,version,source,sourceVersion,sourceUrl,confidence,remark\n08,工学,,DISCIPLINE_CATEGORY,ACADEMIC,"MASTER,DOCTOR",ACTIVE,2022,MOE,2022,,100,\n0812,计算机科学与技术,08,FIRST_LEVEL_DISCIPLINE,ACADEMIC,"MASTER,DOCTOR",ACTIVE,2022,MOE,2022,,100,\n',
      ),
    );
    expect(report.validRows).toBe(2);
    expect(report.sampleRows[0].level).toBe(
      AcademicDisciplineCatalogLevel.DISCIPLINE_CATEGORY,
    );
  });

  it('reports enum errors and duplicate rows', async () => {
    const service = new CatalogImportService(prismaMock());
    const report = await service.previewMajors(
      csv(
        'code,name,educationLevel,status\n080901,计算机科学与技术,BAD,UNKNOWN\n080901,重复专业,BAD,UNKNOWN\n',
      ),
    );
    expect(report.duplicateRows).toBe(1);
    expect(report.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['educationLevel', 'status', 'code']),
    );
  });

  it('rejects missing preview on confirm', async () => {
    await expect(
      new CatalogImportService(prismaMock()).confirmDisciplines('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});
