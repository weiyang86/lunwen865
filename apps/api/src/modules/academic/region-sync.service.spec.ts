import { BadRequestException } from '@nestjs/common';
import { AcademicRegionLevel } from '@prisma/client';
import { normalizeAmapDistricts } from './region-sync.service';

describe('normalizeAmapDistricts', () => {
  it('parses province city and district with adcode parent links', () => {
    const regions = normalizeAmapDistricts({
      status: '1',
      infocode: '10000',
      districts: [
        {
          adcode: '100000',
          name: '中国',
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
          ],
        },
      ],
    });
    expect(regions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: '500000',
          level: AcademicRegionLevel.PROVINCE,
          parentCode: null,
        }),
        expect.objectContaining({
          code: '500100',
          level: AcademicRegionLevel.CITY,
          parentCode: '500000',
        }),
        expect.objectContaining({
          code: '500103',
          level: AcademicRegionLevel.DISTRICT,
          parentCode: '500100',
        }),
      ]),
    );
  });

  it('throws clear error when amap status is not successful', () => {
    expect(() =>
      normalizeAmapDistricts({ status: '0', info: 'INVALID_USER_KEY' }),
    ).toThrow(BadRequestException);
  });
});
