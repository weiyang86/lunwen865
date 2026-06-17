import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AcademicRegionLevel,
  AcademicRegionReviewStatus,
  AcademicRegionSource,
  AcademicRegionStatus,
  AcademicSyncJobStatus,
  AcademicSyncJobType,
  AcademicSyncLogLevel,
  AcademicSyncScope,
  AcademicSyncSource,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListRegionsDto, ListSyncLogsDto } from './dto/academic.dto';

const AMAP_DISTRICT_URL = 'https://restapi.amap.com/v3/config/district';
const MOCK_ENABLED =
  ['1', 'true', 'yes'].includes(
    String(process.env.ACADEMIC_REGION_SYNC_MOCK ?? '').toLowerCase(),
  ) || process.env.NODE_ENV === 'test';

export type NormalizedRegion = {
  code: string;
  name: string;
  level: AcademicRegionLevel;
  parentCode: string | null;
  sortOrder: number;
  sourceVersion?: string;
  sourceUrl?: string;
  syncKey: string;
  confidence: number;
};

type AmapDistrict = {
  adcode?: string | unknown[];
  name?: string;
  level?: string;
  districts?: AmapDistrict[];
  citycode?: string | unknown[];
};

type AmapResponse = {
  status?: string;
  info?: string;
  infocode?: string;
  districts?: AmapDistrict[];
};

export function normalizeAmapDistricts(
  input: AmapResponse,
  sourceUrl = AMAP_DISTRICT_URL,
): NormalizedRegion[] {
  if (input.status !== '1')
    throw new BadRequestException(
      `高德行政区域 API 返回异常：${input.info || input.infocode || 'UNKNOWN'}`,
    );
  const result: NormalizedRegion[] = [];
  const seen = new Set<string>();
  const pushChildren = (
    nodes: AmapDistrict[] | undefined,
    parentCode: string | null,
    depth: number,
  ) => {
    nodes?.forEach((node, index) => {
      const code = typeof node.adcode === 'string' ? node.adcode : '';
      const name = node.name?.trim() ?? '';
      if (!code || !name || code === '100000') {
        pushChildren(node.districts, null, depth);
        return;
      }
      const level = toRegionLevel(node.level, depth);
      if (!seen.has(code)) {
        seen.add(code);
        result.push({
          code,
          name,
          level,
          parentCode,
          sortOrder: index,
          sourceVersion: input.infocode,
          sourceUrl,
          syncKey: `AMAP:${code}`,
          confidence:
            code.endsWith('00') || level === AcademicRegionLevel.DISTRICT
              ? 1
              : 0.9,
        });
      }
      pushChildren(node.districts, code, depth + 1);
    });
  };
  pushChildren(input.districts, null, 0);
  return result;
}

function toRegionLevel(
  level: string | undefined,
  depth: number,
): AcademicRegionLevel {
  if (level === 'province') return AcademicRegionLevel.PROVINCE;
  if (level === 'city') return AcademicRegionLevel.CITY;
  if (level === 'district') return AcademicRegionLevel.DISTRICT;
  return depth <= 0
    ? AcademicRegionLevel.PROVINCE
    : depth === 1
      ? AcademicRegionLevel.CITY
      : AcademicRegionLevel.DISTRICT;
}

function mockAmapResponse(): AmapResponse {
  return {
    status: '1',
    info: 'OK',
    infocode: 'MOCK-20260617',
    districts: [
      {
        adcode: '100000',
        name: '中华人民共和国',
        level: 'country',
        districts: [
          {
            adcode: '500000',
            name: '重庆市',
            level: 'province',
            districts: [
              {
                adcode: '500100',
                name: '重庆城区',
                level: 'city',
                districts: [
                  { adcode: '500103', name: '渝中区', level: 'district' },
                ],
              },
            ],
          },
          {
            adcode: '510000',
            name: '四川省',
            level: 'province',
            districts: [
              {
                adcode: '510100',
                name: '成都市',
                level: 'city',
                districts: [
                  { adcode: '510104', name: '锦江区', level: 'district' },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

@Injectable()
export class RegionSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async listRegions(q: ListRegionsDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20)));
    const where: Prisma.AcademicRegionWhereInput = {};
    if (q.keyword?.trim())
      where.OR = [
        { name: { contains: q.keyword.trim() } },
        { code: { contains: q.keyword.trim() } },
      ];
    if (q.level) where.level = q.level;
    if (q.parentCode) where.parentCode = q.parentCode;
    if (q.status) where.status = q.status;
    const [total, list] = await this.prisma.$transaction([
      this.prisma.academicRegion.count({ where }),
      this.prisma.academicRegion.findMany({
        where,
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { list, total, page, pageSize };
  }

  async preview() {
    const regions = await this.fetchRegions();
    const existing = await this.prisma.academicRegion.findMany({
      where: { code: { in: regions.map((x) => x.code) } },
      select: { code: true, name: true, parentCode: true, level: true },
    });
    const existingMap = new Map(existing.map((x) => [x.code, x]));
    const updates = regions.filter((r) => existingMap.has(r.code));
    const errors = regions.filter(
      (r) => r.level !== AcademicRegionLevel.PROVINCE && !r.parentCode,
    );
    return {
      total: regions.length,
      createCount: regions.length - updates.length,
      updateCount: updates.length,
      warningCount: errors.length,
      samples: regions.slice(0, 20),
      errors: errors
        .slice(0, 20)
        .map((x) => ({ code: x.code, message: '非省级节点缺少 parentCode' })),
      apiKeyConfigured: this.isKeyConfigured(),
      mock: this.useMock(),
    };
  }

  async confirm() {
    const regions = await this.fetchRegions();
    const job = await this.prisma.academicSyncJob.upsert({
      where: {
        type_scope: {
          type: AcademicSyncJobType.REGION_AMAP,
          scope: AcademicSyncScope.NATIONAL,
        },
      },
      create: {
        name: '高德全国行政区域同步',
        type: AcademicSyncJobType.REGION_AMAP,
        source: AcademicSyncSource.AMAP,
        scope: AcademicSyncScope.NATIONAL,
        status: AcademicSyncJobStatus.RUNNING,
        lastRunAt: new Date(),
        config: { subdistrict: 3 },
      },
      update: { status: AcademicSyncJobStatus.RUNNING, lastRunAt: new Date() },
    });
    try {
      const now = new Date();
      await this.prisma.$transaction(
        regions.map((r) =>
          this.prisma.academicRegion.upsert({
            where: { code: r.code },
            create: {
              ...r,
              status: AcademicRegionStatus.ACTIVE,
              source: AcademicRegionSource.AMAP,
              reviewStatus: AcademicRegionReviewStatus.APPROVED,
              reviewedAt: now,
              lastSyncedAt: now,
            },
            update: {
              name: r.name,
              level: r.level,
              parentCode: r.parentCode,
              sortOrder: r.sortOrder,
              source: AcademicRegionSource.AMAP,
              sourceVersion: r.sourceVersion,
              sourceUrl: r.sourceUrl,
              syncKey: r.syncKey,
              confidence: r.confidence,
              status: AcademicRegionStatus.ACTIVE,
              lastSyncedAt: now,
              reviewStatus: AcademicRegionReviewStatus.APPROVED,
              reviewedAt: now,
            },
          }),
        ),
      );
      await this.prisma.academicSyncLog.create({
        data: {
          jobId: job.id,
          level: AcademicSyncLogLevel.INFO,
          message: `地区数据同步成功：${regions.length} 条`,
          detail: { total: regions.length, mock: this.useMock() },
        },
      });
      await this.prisma.academicSyncJob.update({
        where: { id: job.id },
        data: { status: AcademicSyncJobStatus.SUCCESS, lastSuccessAt: now },
      });
      return { total: regions.length, jobId: job.id };
    } catch (e) {
      await this.prisma.academicSyncLog.create({
        data: {
          jobId: job.id,
          level: AcademicSyncLogLevel.ERROR,
          message: '地区数据同步失败',
          detail: { error: e instanceof Error ? e.message : String(e) },
        },
      });
      await this.prisma.academicSyncJob.update({
        where: { id: job.id },
        data: { status: AcademicSyncJobStatus.FAILED },
      });
      throw e;
    }
  }

  async logs(q: ListSyncLogsDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20)));
    const where: Prisma.AcademicSyncLogWhereInput = q.jobType
      ? { job: { type: q.jobType } }
      : {};
    const [total, list] = await this.prisma.$transaction([
      this.prisma.academicSyncLog.count({ where }),
      this.prisma.academicSyncLog.findMany({
        where,
        include: { job: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { list, total, page, pageSize };
  }

  async status() {
    const job = await this.prisma.academicSyncJob.findUnique({
      where: {
        type_scope: {
          type: AcademicSyncJobType.REGION_AMAP,
          scope: AcademicSyncScope.NATIONAL,
        },
      },
    });
    return {
      apiKeyConfigured: this.isKeyConfigured(),
      mock: this.useMock(),
      lastRunAt: job?.lastRunAt ?? null,
      lastSuccessAt: job?.lastSuccessAt ?? null,
      status: job?.status ?? AcademicSyncJobStatus.IDLE,
    };
  }

  private async fetchRegions() {
    if (this.useMock())
      return normalizeAmapDistricts(mockAmapResponse(), 'mock://amap/district');
    const key = process.env.AMAP_WEB_SERVICE_KEY?.trim();
    if (!key)
      throw new BadRequestException(
        '未配置 AMAP_WEB_SERVICE_KEY，无法调用高德行政区域 API；本地测试可设置 ACADEMIC_REGION_SYNC_MOCK=true 使用 mock 数据',
      );
    const url = `${AMAP_DISTRICT_URL}?keywords=中国&subdistrict=3&key=${encodeURIComponent(key)}`;
    const resp = await fetch(url);
    if (!resp.ok)
      throw new BadRequestException(
        `高德行政区域 API 请求失败：HTTP ${resp.status}`,
      );
    return normalizeAmapDistricts(
      (await resp.json()) as AmapResponse,
      AMAP_DISTRICT_URL,
    );
  }

  private useMock() {
    return MOCK_ENABLED;
  }
  private isKeyConfigured() {
    return Boolean(process.env.AMAP_WEB_SERVICE_KEY?.trim());
  }
}
