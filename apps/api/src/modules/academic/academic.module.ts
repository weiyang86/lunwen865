import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller';
import { AdminAcademicController } from './admin-academic.controller';
import { AcademicDataCatalogController } from './academic-data-catalog.controller';
import { AcademicService } from './academic.service';
import { RegionSyncService } from './region-sync.service';
import { SchoolImportService } from './school-import.service';
import { CatalogImportService } from './catalog-import.service';
import { CollegeDataService } from './college-data.service';
import { SchoolMajorDataService } from './school-major-data.service';
import { AcademicContextService } from './academic-context.service';

@Module({
  controllers: [
    AcademicController,
    AcademicDataCatalogController,
    AdminAcademicController,
  ],
  providers: [
    AcademicService,
    RegionSyncService,
    SchoolImportService,
    CatalogImportService,
    CollegeDataService,
    SchoolMajorDataService,
    AcademicContextService,
  ],
  exports: [AcademicService, SchoolMajorDataService, AcademicContextService],
})
export class AcademicModule {}
