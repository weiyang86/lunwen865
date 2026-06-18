import { NotFoundException } from '@nestjs/common';
import { AcademicRegionLevel } from '@prisma/client';
import { parseSchoolFile, SchoolImportService } from './school-import.service';

type AcademicImportPrismaMock = ConstructorParameters<
  typeof SchoolImportService
>[0] & {
  academicRegion: { findMany: jest.Mock };
  academicSchool: { findMany: jest.Mock; upsert?: jest.Mock };
};

function csv(content: string) {
  return {
    originalname: 'schools.csv',
    mimetype: 'text/csv',
    buffer: Buffer.from(content, 'utf8'),
  };
}

function prismaMock(existingCodes: string[] = []): AcademicImportPrismaMock {
  const regions = [
    {
      code: '500000',
      name: '重庆市',
      level: AcademicRegionLevel.PROVINCE,
      parentCode: null,
    },
    {
      code: '500100',
      name: '重庆城区',
      level: AcademicRegionLevel.CITY,
      parentCode: '500000',
    },
  ];
  return {
    academicRegion: { findMany: jest.fn().mockResolvedValue(regions) },
    academicSchool: {
      findMany: jest
        .fn()
        .mockResolvedValue(existingCodes.map((code) => ({ code }))),
    },
  } as unknown as AcademicImportPrismaMock;
}

describe('SchoolImportService', () => {
  it('parses CSV legacy template', async () => {
    const rows = await parseSchoolFile(
      csv(
        'provinceCode,cityCode,name,code,schoolType,educationLevels,status,sortOrder,remark\n500000,500100,重庆大学,10611,UNDERGRADUATE,"UNDERGRADUATE,MASTER",ACTIVE,0,示例\n',
      ),
    );
    expect(rows[0]).toMatchObject({
      provinceCode: '500000',
      cityCode: '500100',
      name: '重庆大学',
      code: '10611',
    });
  });

  it('previews extended template create rows without writing database', async () => {
    const prisma = prismaMock();
    const service = new SchoolImportService(prisma);
    const result = await service.preview(
      csv(
        'provinceCode,cityCode,name,code,schoolType,educationLevels,status,sortOrder,source,sourceVersion,sourceUrl,confidence,remark\n500000,500100,重庆大学,10611,UNDERGRADUATE,"UNDERGRADUATE,MASTER",ACTIVE,0,MOE,2026,http://example.com,100,示例\n',
      ),
    );
    expect(result).toMatchObject({
      totalRows: 1,
      validRows: 1,
      createRows: 1,
      updateRows: 0,
      errorRows: 0,
    });
    expect(prisma.academicSchool.findMany).toHaveBeenCalled();
    expect(prisma.academicSchool.upsert).toBeUndefined();
  });

  it('marks existing code as update', async () => {
    const service = new SchoolImportService(prismaMock(['10611']));
    const result = await service.preview(
      csv(
        'provinceCode,cityCode,name,code,办学层次,status\n500000,500100,重庆大学,10611,本科,ACTIVE\n',
      ),
    );
    expect(result.updateRows).toBe(1);
    expect(result.sampleRows[0].schoolType).toBe('UNDERGRADUATE');
  });

  it('returns region errors when provinceCode or cityCode is missing in academic_regions', async () => {
    const service = new SchoolImportService({
      academicRegion: { findMany: jest.fn().mockResolvedValue([]) },
      academicSchool: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as AcademicImportPrismaMock);
    const result = await service.preview(
      csv(
        'provinceCode,cityCode,name,code,schoolType,educationLevels,status\n990000,990100,未知学校,99999,OTHER,UNDERGRADUATE,ACTIVE\n',
      ),
    );
    expect(result.errorRows).toBe(1);
    expect(result.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['provinceCode', 'cityCode']),
    );
  });

  it('reports enum errors', async () => {
    const service = new SchoolImportService(prismaMock());
    const result = await service.preview(
      csv(
        'provinceCode,cityCode,name,code,schoolType,educationLevels,status\n500000,500100,重庆大学,10611,BAD,NOPE,UNKNOWN\n',
      ),
    );
    expect(result.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['schoolType', 'status']),
    );
  });

  it('rejects confirm when preview has expired', async () => {
    const service = new SchoolImportService(prismaMock());
    await expect(service.confirm('missing-preview')).rejects.toThrow(
      NotFoundException,
    );
  });
});
