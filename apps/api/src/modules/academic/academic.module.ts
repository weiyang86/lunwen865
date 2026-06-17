import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AcademicController } from './academic.controller';
import { AdminAcademicController } from './admin-academic.controller';
import { AcademicService } from './academic.service';
import { RegionSyncService } from './region-sync.service';
import { SchoolImportService } from './school-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [AcademicController, AdminAcademicController],
  providers: [AcademicService, RegionSyncService, SchoolImportService],
  exports: [AcademicService],
})
export class AcademicModule {}
