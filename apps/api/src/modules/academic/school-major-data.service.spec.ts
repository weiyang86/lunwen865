/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  AcademicSchoolMajorReviewStatus,
  AcademicSchoolMajorSource,
} from '@prisma/client';
import {
  SchoolMajorDataService,
  extractMajorCandidates,
} from './school-major-data.service';

const csv = (body: string) => ({
  originalname: 'school-majors.csv',
  mimetype: 'text/csv',
  buffer: Buffer.from(body),
});
function prismaMock() {
  return {
    academicSchool: { findMany: jest.fn(), findUnique: jest.fn() },
    academicCatalogMajor: { findMany: jest.fn() },
    academicCollege: { findMany: jest.fn() },
    academicSchoolMajor: {
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    academicSchoolMajorStaging: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}
const header =
  'schoolCode,schoolName,collegeName,majorCode,majorName,educationLevel,status,source,sourceUrl,confidence,remark\n';

describe('SchoolMajorDataService', () => {
  it('parses template import and previews without writing formal table', async () => {
    const prisma = prismaMock();
    prisma.academicSchool.findMany.mockResolvedValue([
      { id: 's1', code: '4150010637', name: '重庆师范大学' },
    ]);
    prisma.academicCatalogMajor.findMany.mockResolvedValue([
      {
        id: 'm1',
        code: '080901',
        name: '计算机科学与技术',
        educationLevel: 'UNDERGRADUATE',
      },
    ]);
    prisma.academicCollege.findMany.mockResolvedValue([
      { id: 'c1', schoolCode: '4150010637', name: '计算机与信息科学学院' },
    ]);
    prisma.academicSchoolMajor.findMany.mockResolvedValue([]);
    const service = new SchoolMajorDataService(prisma as never);
    const preview = await service.preview(
      csv(
        header +
          '4150010637,重庆师范大学,计算机与信息科学学院,080901,计算机科学与技术,UNDERGRADUATE,ACTIVE,MANUAL,,90,\n',
      ),
    );
    expect(preview.validRows).toBe(1);
    expect(preview.sampleRows[0].majorId).toBe('m1');
    expect(preview.sampleRows[0].collegeId).toBe('c1');
    expect(prisma.academicSchoolMajor.upsert).not.toHaveBeenCalled();
  });

  it('reports schoolCode and enum validation errors', async () => {
    const prisma = prismaMock();
    prisma.academicSchool.findMany.mockResolvedValue([]);
    prisma.academicCatalogMajor.findMany.mockResolvedValue([]);
    prisma.academicCollege.findMany.mockResolvedValue([]);
    prisma.academicSchoolMajor.findMany.mockResolvedValue([]);
    const service = new SchoolMajorDataService(prisma as never);
    const preview = await service.preview(
      csv(
        header + 'bad,未知,,080901,计算机科学与技术,UNKNOWN,BAD,MANUAL,,90,\n',
      ),
    );
    expect(preview.validRows).toBe(0);
    expect(preview.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['schoolCode', 'educationLevel', 'status']),
    );
  });

  it('matches majorName when majorCode is absent and warns on unmatched collegeName', async () => {
    const prisma = prismaMock();
    prisma.academicSchool.findMany.mockResolvedValue([
      { id: 's1', code: '4150010637', name: '重庆师范大学' },
    ]);
    prisma.academicCatalogMajor.findMany.mockResolvedValue([
      {
        id: 'm1',
        code: '080901',
        name: '计算机科学与技术',
        educationLevel: 'UNDERGRADUATE',
      },
    ]);
    prisma.academicCollege.findMany.mockResolvedValue([]);
    prisma.academicSchoolMajor.findMany.mockResolvedValue([]);
    const service = new SchoolMajorDataService(prisma as never);
    const preview = await service.preview(
      csv(
        header +
          '4150010637,重庆师范大学,不存在学院,,计算机科学与技术,UNDERGRADUATE,ACTIVE,MANUAL,,90,\n',
      ),
    );
    expect(preview.sampleRows[0].majorCode).toBe('080901');
    expect(preview.warnings.join('\n')).toContain('collegeName 未匹配学院库');
  });

  it('confirms with upsert by schoolCode + majorCode + educationLevel', async () => {
    const prisma = prismaMock();
    prisma.academicSchool.findMany.mockResolvedValue([
      { id: 's1', code: '4150010637', name: '重庆师范大学' },
    ]);
    prisma.academicCatalogMajor.findMany.mockResolvedValue([
      {
        id: 'm1',
        code: '080901',
        name: '计算机科学与技术',
        educationLevel: 'UNDERGRADUATE',
      },
    ]);
    prisma.academicCollege.findMany.mockResolvedValue([]);
    prisma.academicSchoolMajor.findMany.mockResolvedValue([
      {
        schoolCode: '4150010637',
        majorCode: '080901',
        educationLevel: 'UNDERGRADUATE',
      },
    ]);
    prisma.academicSchoolMajor.upsert.mockResolvedValue({ id: 'rel1' });
    const service = new SchoolMajorDataService(prisma as never);
    const preview = await service.preview(
      csv(
        header +
          '4150010637,重庆师范大学,,080901,计算机科学与技术,UNDERGRADUATE,ACTIVE,MANUAL,,90,\n',
      ),
    );
    const result = await service.confirm(preview.previewId);
    expect(result.updateRows).toBe(1);
    expect(prisma.academicSchoolMajor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolCode_majorCode_educationLevel: {
            schoolCode: '4150010637',
            majorCode: '080901',
            educationLevel: 'UNDERGRADUATE',
          },
        },
      }),
    );
  });

  it('approves staging into formal table and rejects without upsert', async () => {
    const prisma = prismaMock();
    prisma.academicSchoolMajorStaging.findUnique.mockResolvedValue({
      id: 'st1',
      schoolId: 's1',
      schoolCode: '4150010637',
      schoolName: '重庆师范大学',
      collegeId: null,
      collegeName: null,
      majorId: 'm1',
      majorCode: '080901',
      majorName: '计算机科学与技术',
      educationLevel: 'UNDERGRADUATE',
      source: AcademicSchoolMajorSource.SCHOOL_SITE,
      sourceUrl: 'https://example.edu.cn',
      confidence: 80,
    });
    prisma.academicSchoolMajor.upsert.mockResolvedValue({ id: 'rel1' });
    prisma.academicSchoolMajorStaging.update.mockResolvedValue({
      id: 'st1',
      reviewStatus: AcademicSchoolMajorReviewStatus.APPROVED,
    });
    const service = new SchoolMajorDataService(prisma as never);
    await service.approve('st1');
    expect(prisma.academicSchoolMajor.upsert).toHaveBeenCalled();
    await service.reject('st1', '重复');
    expect(prisma.academicSchoolMajorStaging.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: AcademicSchoolMajorReviewStatus.REJECTED,
        }),
      }),
    );
  });

  it('extracts major candidates from public html', () => {
    const result = extractMajorCandidates(
      '<a>计算机科学与技术专业</a><a>通知公告</a><span>软件工程</span>',
    );
    expect(result.join(',')).toContain('计算机科学与技术专业');
    expect(result.join(',')).toContain('软件工程');
  });
});
