CREATE TYPE "AcademicSchoolSource" AS ENUM ('MOE', 'CHSI', 'MANUAL');
CREATE TYPE "AcademicSchoolReviewStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

ALTER TABLE "AcademicSchool" ADD COLUMN "provinceCode" VARCHAR(20);
ALTER TABLE "AcademicSchool" ADD COLUMN "cityCode" VARCHAR(20);
ALTER TABLE "AcademicSchool" ADD COLUMN "source" "AcademicSchoolSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "AcademicSchool" ADD COLUMN "sourceVersion" VARCHAR(80);
ALTER TABLE "AcademicSchool" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "AcademicSchool" ADD COLUMN "syncKey" VARCHAR(120);
ALTER TABLE "AcademicSchool" ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 80;
ALTER TABLE "AcademicSchool" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "AcademicSchool" ADD COLUMN "reviewStatus" "AcademicSchoolReviewStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "AcademicSchool" ADD COLUMN "reviewedBy" VARCHAR(100);
ALTER TABLE "AcademicSchool" ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "AcademicSchool_provinceCode_status_sortOrder_idx" ON "AcademicSchool"("provinceCode", "status", "sortOrder");
CREATE INDEX "AcademicSchool_cityCode_status_sortOrder_idx" ON "AcademicSchool"("cityCode", "status", "sortOrder");
CREATE INDEX "AcademicSchool_schoolType_idx" ON "AcademicSchool"("schoolType");
