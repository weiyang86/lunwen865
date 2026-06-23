import { Injectable } from '@nestjs/common';
import { SchoolMajorDataService } from './school-major-data.service';

@Injectable()
export class AcademicContextService {
  constructor(
    private readonly schoolMajorDataService: SchoolMajorDataService,
  ) {}

  getSchoolMajorContext(params: {
    schoolCode: string;
    collegeName?: string;
    majorName?: string;
    educationLevel?: string;
  }) {
    return this.schoolMajorDataService.getSchoolMajorContext(params);
  }
}
