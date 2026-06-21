import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AcademicController } from './academic.controller';
import { AdminAcademicController } from './admin-academic.controller';
import { AcademicDataCatalogController } from './academic-data-catalog.controller';
import { AcademicService } from './academic.service';
import { RegionSyncService } from './region-sync.service';
import { SchoolImportService } from './school-import.service';
import { CatalogImportService } from './catalog-import.service';

@Module({
  imports: [PrismaModule],
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
  ],
  exports: [AcademicService],
})
export class AcademicModule {}
