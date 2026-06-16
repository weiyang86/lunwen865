import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AcademicService } from './academic.service';
import {
  QueryCitiesDto,
  QueryCollegesDto,
  QueryLevelOnesDto,
  QueryLevelTwosDto,
  QueryMajorsDto,
  QuerySchoolsDto,
} from './dto/academic.dto';

@Public()
@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Get('provinces')
  provinces() {
    return this.academicService.listProvinces();
  }

  @Get('cities')
  cities(@Query() query: QueryCitiesDto) {
    return this.academicService.listCities(query.provinceId);
  }

  @Get('schools')
  schools(@Query() query: QuerySchoolsDto) {
    return this.academicService.listSchools(query, true);
  }

  @Get('colleges')
  colleges(@Query() query: QueryCollegesDto) {
    return this.academicService.listColleges(query, true);
  }

  @Get('majors')
  majors(@Query() query: QueryMajorsDto) {
    return this.academicService.listMajors(query, true);
  }

  @Get('disciplines/categories')
  disciplineCategories() {
    return this.academicService.listDisciplineCategories();
  }

  @Get('disciplines/level-ones')
  disciplineLevelOnes(@Query() query: QueryLevelOnesDto) {
    return this.academicService.listDisciplineLevelOnes(query.categoryId);
  }

  @Get('disciplines/level-twos')
  disciplineLevelTwos(@Query() query: QueryLevelTwosDto) {
    return this.academicService.listDisciplineLevelTwos(query.levelOneId);
  }
}
