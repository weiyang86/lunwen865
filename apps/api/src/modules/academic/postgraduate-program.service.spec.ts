/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  AcademicPostgraduateDegreeLevel,
  AcademicPostgraduateProgramReviewStatus,
  AcademicPostgraduateProgramSource,
  AcademicPostgraduateProgramType,
  AcademicPostgraduateStudyMode,
} from '@prisma/client';
import { AcademicContextService } from './academic-context.service';
import {
  PostgraduateProgramService,
  extractPostgraduateProgramCandidates,
} from './postgraduate-program.service';

const header =
  'schoolCode,schoolName,collegeName,disciplineCode,disciplineName,programCode,programName,programType,degreeLevel,researchDirection,studyMode,status,source,sourceVersion,sourceUrl,confidence,remark\n';
const csv = (body: string) => ({
  originalname: 'pg.csv',
  mimetype: 'text/csv',
  buffer: Buffer.from(body),
});
function prismaMock() {
  return {
    academicSchool: { findMany: jest.fn(), findUnique: jest.fn() },
    academicDisciplineCatalog: { findMany: jest.fn(), findUnique: jest.fn() },
    academicCollege: { findMany: jest.fn() },
    academicPostgraduateProgram: {
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    academicPostgraduateProgramStaging: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('PostgraduateProgramService', () => {
  it('previews template import and matches disciplineCode without writing formal table', async () => {
    const prisma = prismaMock();
    prisma.academicSchool.findMany.mockResolvedValue([
      { id: 's1', code: '4150010637', name: '重庆师范大学' },
    ]);
    prisma.academicDisciplineCatalog.findMany.mockResolvedValue([
      { id: 'd1', code: '0812', name: '计算机科学与技术' },
    ]);
    prisma.academicCollege.findMany.mockResolvedValue([
      { id: 'c1', schoolCode: '4150010637', name: '计算机与信息科学学院' },
    ]);
    prisma.academicPostgraduateProgram.findMany.mockResolvedValue([]);
    const service = new PostgraduateProgramService(prisma as never);
    const preview = await service.preview(
      csv(
        header +
          '4150010637,重庆师范大学,计算机与信息科学学院,0812,计算机科学与技术,081200,计算机科学与技术,ACADEMIC,MASTER,人工智能,FULL_TIME,ACTIVE,MANUAL,2026,,90,\n',
      ),
    );
    expect(preview.validRows).toBe(1);
    expect(preview.sampleRows[0].disciplineCode).toBe('0812');
    expect(preview.sampleRows[0].collegeId).toBe('c1');
    expect(prisma.academicPostgraduateProgram.upsert).not.toHaveBeenCalled();
  });

  it('reports schoolCode, programType and degreeLevel validation errors', async () => {
    const prisma = prismaMock();
    prisma.academicSchool.findMany.mockResolvedValue([]);
    prisma.academicDisciplineCatalog.findMany.mockResolvedValue([]);
    prisma.academicCollege.findMany.mockResolvedValue([]);
    prisma.academicPostgraduateProgram.findMany.mockResolvedValue([]);
    const service = new PostgraduateProgramService(prisma as never);
    const preview = await service.preview(
      csv(
        header +
          'bad,未知,,0812,计算机科学与技术,081200,计算机科学与技术,BAD,BAD,方向,FULL_TIME,ACTIVE,MANUAL,2026,,90,\n',
      ),
    );
    expect(preview.validRows).toBe(0);
    expect(preview.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['schoolCode', 'programType', 'degreeLevel']),
    );
  });

  it('confirms and upserts by syncKey', async () => {
    const prisma = prismaMock();
    prisma.academicSchool.findMany.mockResolvedValue([
      { id: 's1', code: '4150010637', name: '重庆师范大学' },
    ]);
    prisma.academicDisciplineCatalog.findMany.mockResolvedValue([
      { id: 'd1', code: '0812', name: '计算机科学与技术' },
    ]);
    prisma.academicCollege.findMany.mockResolvedValue([]);
    prisma.academicPostgraduateProgram.findMany.mockResolvedValue([
      { syncKey: '4150010637::081200:MASTER:人工智能' },
    ]);
    prisma.academicPostgraduateProgram.upsert.mockResolvedValue({ id: 'p1' });
    const service = new PostgraduateProgramService(prisma as never);
    const preview = await service.preview(
      csv(
        header +
          '4150010637,重庆师范大学,,0812,计算机科学与技术,081200,计算机科学与技术,ACADEMIC,MASTER,人工智能,FULL_TIME,ACTIVE,MANUAL,2026,,90,\n',
      ),
    );
    const result = await service.confirm(preview.previewId);
    expect(result.updateRows).toBe(1);
    expect(prisma.academicPostgraduateProgram.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { syncKey: '4150010637::081200:MASTER:人工智能' },
      }),
    );
  });

  it('approves staging into formal table and rejects without additional formal write', async () => {
    const prisma = prismaMock();
    prisma.academicPostgraduateProgramStaging.findUnique.mockResolvedValue({
      id: 'st1',
      schoolId: 's1',
      schoolCode: '4150010637',
      schoolName: '重庆师范大学',
      collegeId: null,
      collegeName: null,
      disciplineCode: '0812',
      disciplineName: '计算机科学与技术',
      programCode: '081200',
      programName: '计算机科学与技术',
      programType: AcademicPostgraduateProgramType.ACADEMIC,
      degreeLevel: AcademicPostgraduateDegreeLevel.MASTER,
      researchDirection: '人工智能',
      studyMode: AcademicPostgraduateStudyMode.FULL_TIME,
      source: AcademicPostgraduateProgramSource.GRADUATE_SCHOOL,
      sourceUrl: 'https://example.edu.cn',
      confidence: 80,
      rawData: {},
    });
    prisma.academicPostgraduateProgram.upsert.mockResolvedValue({ id: 'p1' });
    prisma.academicPostgraduateProgramStaging.update.mockResolvedValue({
      id: 'st1',
      reviewStatus: AcademicPostgraduateProgramReviewStatus.APPROVED,
    });
    const service = new PostgraduateProgramService(prisma as never);
    await service.approve('st1');
    expect(prisma.academicPostgraduateProgram.upsert).toHaveBeenCalledTimes(1);
    await service.reject('st1', '重复');
    expect(
      prisma.academicPostgraduateProgramStaging.update,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: AcademicPostgraduateProgramReviewStatus.REJECTED,
        }),
      }),
    );
    expect(prisma.academicPostgraduateProgram.upsert).toHaveBeenCalledTimes(1);
  });

  it('extracts postgraduate candidates from public html', () => {
    const result = extractPostgraduateProgramCandidates(
      '<p>081200 计算机科学与技术 研究方向:人工智能 全日制</p>',
      [{ code: '0812', name: '计算机科学与技术' }],
    );
    expect(result[0].programCode).toBe('081200');
    expect(result[0].researchDirection).toContain('人工智能');
  });
});

describe('AcademicContextService postgraduate context', () => {
  it('returns postgraduate branch and undergraduate branch from unified thesis context', async () => {
    const schoolMajorDataService = {
      getSchoolMajorContext: jest.fn().mockResolvedValue({
        matchedRelations: [{ majorName: '计算机科学与技术' }],
      }),
    };
    const postgraduateProgramService = {
      getPostgraduateContext: jest.fn().mockResolvedValue({
        postgraduatePrograms: [{ programName: '计算机科学与技术' }],
      }),
    };
    const service = new AcademicContextService(
      schoolMajorDataService as never,
      postgraduateProgramService as never,
    );
    await expect(
      service.getThesisAcademicContext({
        schoolCode: '4150010637',
        educationLevel: 'MASTER',
        programName: '计算机科学与技术',
      }),
    ).resolves.toHaveProperty('postgraduate');
    await expect(
      service.getThesisAcademicContext({
        schoolCode: '4150010637',
        educationLevel: 'UNDERGRADUATE',
        majorName: '计算机科学与技术',
      }),
    ).resolves.toHaveProperty('schoolMajor');
  });
});
