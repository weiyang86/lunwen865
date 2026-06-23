import { Injectable } from '@nestjs/common';
import { SchoolMajorDataService } from './school-major-data.service';
import { PostgraduateProgramService } from './postgraduate-program.service';

@Injectable()
export class AcademicContextService {
  constructor(
    private readonly schoolMajorDataService: SchoolMajorDataService,
    private readonly postgraduateProgramService: PostgraduateProgramService,
  ) {}

  getSchoolMajorContext(params: {
    schoolCode: string;
    collegeName?: string;
    majorName?: string;
    educationLevel?: string;
  }) {
    return this.schoolMajorDataService.getSchoolMajorContext(params);
  }

  getPostgraduateContext(params: {
    schoolCode: string;
    collegeName?: string;
    disciplineCode?: string;
    programName?: string;
    degreeLevel?: string;
  }) {
    return this.postgraduateProgramService.getPostgraduateContext(params);
  }

  async getThesisAcademicContext(params: {
    schoolCode: string;
    educationLevel: string;
    collegeName?: string;
    majorName?: string;
    disciplineCode?: string;
    programName?: string;
  }) {
    if (
      params.educationLevel === 'MASTER' ||
      params.educationLevel === 'DOCTOR'
    ) {
      return {
        educationLevel: params.educationLevel,
        postgraduate: await this.getPostgraduateContext({
          schoolCode: params.schoolCode,
          collegeName: params.collegeName,
          disciplineCode: params.disciplineCode,
          programName: params.programName,
          degreeLevel: params.educationLevel,
        }),
      };
    }
    return {
      educationLevel: params.educationLevel,
      schoolMajor: await this.getSchoolMajorContext({
        schoolCode: params.schoolCode,
        collegeName: params.collegeName,
        majorName: params.majorName,
        educationLevel: params.educationLevel,
      }),
    };
  }
}
