-- Add nullable academic context fields to keep historical tasks compatible.
ALTER TABLE "Task" ADD COLUMN "provinceId" TEXT;
ALTER TABLE "Task" ADD COLUMN "cityId" TEXT;
ALTER TABLE "Task" ADD COLUMN "academicSchoolId" TEXT;
ALTER TABLE "Task" ADD COLUMN "collegeId" TEXT;
ALTER TABLE "Task" ADD COLUMN "majorId" TEXT;
ALTER TABLE "Task" ADD COLUMN "disciplineCategoryId" TEXT;
ALTER TABLE "Task" ADD COLUMN "disciplineLevelOneId" TEXT;
ALTER TABLE "Task" ADD COLUMN "disciplineLevelTwoId" TEXT;
ALTER TABLE "Task" ADD COLUMN "thesisType" VARCHAR(60);
ALTER TABLE "Task" ADD COLUMN "researchDirection" TEXT;
ALTER TABLE "Task" ADD COLUMN "advisorRequirement" TEXT;
ALTER TABLE "Task" ADD COLUMN "formatTemplateId" TEXT;

CREATE INDEX "Task_provinceId_idx" ON "Task"("provinceId");
CREATE INDEX "Task_cityId_idx" ON "Task"("cityId");
CREATE INDEX "Task_academicSchoolId_idx" ON "Task"("academicSchoolId");
CREATE INDEX "Task_collegeId_idx" ON "Task"("collegeId");
CREATE INDEX "Task_majorId_idx" ON "Task"("majorId");
CREATE INDEX "Task_disciplineCategoryId_idx" ON "Task"("disciplineCategoryId");
CREATE INDEX "Task_disciplineLevelOneId_idx" ON "Task"("disciplineLevelOneId");
CREATE INDEX "Task_disciplineLevelTwoId_idx" ON "Task"("disciplineLevelTwoId");
CREATE INDEX "Task_educationLevel_idx" ON "Task"("educationLevel");
CREATE INDEX "Task_thesisType_idx" ON "Task"("thesisType");

ALTER TABLE "Task" ADD CONSTRAINT "Task_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "AcademicProvince"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "AcademicCity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_academicSchoolId_fkey" FOREIGN KEY ("academicSchoolId") REFERENCES "AcademicSchool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "AcademicCollege"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "AcademicMajor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_disciplineCategoryId_fkey" FOREIGN KEY ("disciplineCategoryId") REFERENCES "DisciplineCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_disciplineLevelOneId_fkey" FOREIGN KEY ("disciplineLevelOneId") REFERENCES "DisciplineLevelOne"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_disciplineLevelTwoId_fkey" FOREIGN KEY ("disciplineLevelTwoId") REFERENCES "DisciplineLevelTwo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
