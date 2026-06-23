CREATE TYPE "AcademicCollegeSource" AS ENUM ('SCHOOL_SITE', 'MANUAL');
CREATE TYPE "AcademicCollegeReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "AcademicCrawlSourceType" AS ENUM ('COLLEGE_PAGE');

ALTER TABLE "AcademicCollege" ADD COLUMN "schoolCode" VARCHAR(50);
ALTER TABLE "AcademicCollege" ADD COLUMN "source" "AcademicCollegeSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "AcademicCollege" ADD COLUMN "sourceVersion" VARCHAR(80);
ALTER TABLE "AcademicCollege" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "AcademicCollege" ADD COLUMN "syncKey" VARCHAR(160);
ALTER TABLE "AcademicCollege" ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 90;
ALTER TABLE "AcademicCollege" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "AcademicCollege" ADD COLUMN "reviewStatus" "AcademicCollegeReviewStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "AcademicCollege" ADD COLUMN "reviewedBy" VARCHAR(100);
ALTER TABLE "AcademicCollege" ADD COLUMN "reviewedAt" TIMESTAMP(3);
CREATE INDEX "AcademicCollege_schoolCode_status_idx" ON "AcademicCollege"("schoolCode", "status");

CREATE TABLE "academic_college_staging" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "schoolCode" VARCHAR(50),
  "schoolName" VARCHAR(150),
  "collegeName" VARCHAR(150) NOT NULL,
  "collegeUrl" TEXT,
  "source" "AcademicCollegeSource" NOT NULL DEFAULT 'SCHOOL_SITE',
  "sourceUrl" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 70,
  "rawData" JSONB,
  "reviewStatus" "AcademicCollegeReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" VARCHAR(100),
  "reviewedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_college_staging_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "academic_college_staging_schoolCode_reviewStatus_idx" ON "academic_college_staging"("schoolCode", "reviewStatus");
CREATE INDEX "academic_college_staging_reviewStatus_confidence_idx" ON "academic_college_staging"("reviewStatus", "confidence");

CREATE TABLE "academic_crawl_sources" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "schoolCode" VARCHAR(50),
  "sourceType" "AcademicCrawlSourceType" NOT NULL DEFAULT 'COLLEGE_PAGE',
  "url" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "scope" "AcademicSyncScope" NOT NULL DEFAULT 'SOUTHWEST',
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_crawl_sources_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "academic_crawl_sources_schoolCode_enabled_idx" ON "academic_crawl_sources"("schoolCode", "enabled");
