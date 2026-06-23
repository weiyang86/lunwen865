/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { AcademicCollegeReviewStatus } from '@prisma/client';
import {
  CollegeDataService,
  extractCollegeCandidates,
} from './college-data.service';

function csv(content: string) {
  return {
    originalname: 'colleges.csv',
    mimetype: 'text/csv',
    buffer: Buffer.from(content, 'utf8'),
  };
}
function prismaMock() {
  const school = {
    id: 'school-1',
    code: '4150010637',
    name: '重庆师范大学',
    provinceCode: '500000',
    cityCode: '500100',
  };
  return {
    academicSchool: {
      findMany: jest.fn().mockResolvedValue([school]),
      findUnique: jest.fn().mockResolvedValue(school),
    },
    academicCollege: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn(),
      upsert: jest.fn().mockResolvedValue({ id: 'college-1' }),
    },
    academicCollegeStaging: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'stage-1' }),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    academicCrawlSource: { create: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  } as any;
}

describe('CollegeDataService', () => {
  it('parses college template and previews rows', async () => {
    const service = new CollegeDataService(prismaMock());
    const report = await service.preview(
      csv(
        'schoolCode,schoolName,collegeName,collegeCode,status,source,sourceUrl,confidence,remark\n4150010637,重庆师范大学,计算机与信息科学学院,,ACTIVE,MANUAL,,90,\n',
      ),
    );
    expect(report.validRows).toBe(1);
    expect(report.createRows).toBe(1);
  });
  it('reports missing schoolCode', async () => {
    const p = prismaMock();
    p.academicSchool.findMany.mockResolvedValue([]);
    const report = await new CollegeDataService(p).preview(
      csv('schoolCode,schoolName,collegeName\n000,未知,计算机学院\n'),
    );
    expect(report.errors.map((e) => e.field)).toContain('schoolCode');
  });
  it('confirms with schoolCode + collegeName upsert', async () => {
    const p = prismaMock();
    const service = new CollegeDataService(p);
    const report = await service.preview(
      csv(
        'schoolCode,schoolName,collegeName\n4150010637,重庆师范大学,计算机学院\n',
      ),
    );
    await service.confirm(report.previewId);
    expect(p.academicCollege.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId_name: { schoolId: 'school-1', name: '计算机学院' } },
      }),
    );
  });
  it('extracts college candidates from html', () => {
    const list = extractCollegeCandidates(
      '<a href="/cs">计算机学院</a><a href="/news">新闻动态</a><a href="/ai">人工智能研究院</a>',
      'https://example.edu.cn',
    );
    expect(list.map((x) => x.name)).toEqual(['计算机学院', '人工智能研究院']);
  });
  it('approves staging into formal college', async () => {
    const p = prismaMock();
    p.academicCollegeStaging.findUnique.mockResolvedValue({
      id: 's1',
      schoolCode: '4150010637',
      collegeName: '数学科学学院',
      source: 'SCHOOL_SITE',
      sourceUrl: 'https://x',
      confidence: 80,
    });
    await new CollegeDataService(p).approve('s1');
    expect(p.academicCollege.upsert).toHaveBeenCalled();
    expect(p.academicCollegeStaging.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: AcademicCollegeReviewStatus.APPROVED,
        }),
      }),
    );
  });
  it('reject does not write formal college', async () => {
    const p = prismaMock();
    await new CollegeDataService(p).reject('s1', '重复');
    expect(p.academicCollege.upsert).not.toHaveBeenCalled();
    expect(p.academicCollegeStaging.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: AcademicCollegeReviewStatus.REJECTED,
        }),
      }),
    );
  });
});
