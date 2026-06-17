import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller';
import { AdminAcademicController } from './admin-academic.controller';
import { AcademicService } from './academic.service';
import { RegionSyncService } from './region-sync.service';

@Module({
  controllers: [AcademicController, AdminAcademicController],
  providers: [AcademicService, RegionSyncService],
  exports: [AcademicService],
})
export class AcademicModule {}
