import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller';
import { AdminAcademicController } from './admin-academic.controller';
import { AcademicService } from './academic.service';

@Module({
  controllers: [AcademicController, AdminAcademicController],
  providers: [AcademicService],
  exports: [AcademicService],
})
export class AcademicModule {}
