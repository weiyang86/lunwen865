-- AcademicData-05: school-college-major relations and staging review workflow.
CREATE TYPE "AcademicSchoolMajorSource" AS ENUM ('ADMISSION_SITE', 'SCHOOL_SITE', 'MANUAL');
CREATE TYPE "AcademicSchoolMajorReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "academic_school_majors" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "schoolCode" VARCHAR(50) NOT NULL,
  "collegeId" TEXT,
  "collegeName" VARCHAR(150),
  "majorId" TEXT,
  "majorCode" VARCHAR(50) NOT NULL,
  "majorName" VARCHAR(150) NOT NULL,
  "educationLevel" VARCHAR(40) NOT NULL,
  "status" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "AcademicSchoolMajorSource" NOT NULL DEFAULT 'MANUAL',
  "sourceVersion" VARCHAR(80),
  "sourceUrl" TEXT,
  "syncKey" VARCHAR(180),
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 90,
  "lastSyncedAt" TIMESTAMP(3),
  "reviewStatus" "AcademicSchoolMajorReviewStatus" NOT NULL DEFAULT 'APPROVED',
  "reviewedBy" VARCHAR(100),
  "reviewedAt" TIMESTAMP(3),
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_school_majors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_school_major_staging" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "schoolCode" VARCHAR(50),
  "schoolName" VARCHAR(150),
  "collegeId" TEXT,
  "collegeName" VARCHAR(150),
  "majorId" TEXT,
  "majorCode" VARCHAR(50),
  "majorName" VARCHAR(150) NOT NULL,
  "educationLevel" VARCHAR(40) NOT NULL,
  "source" "AcademicSchoolMajorSource" NOT NULL DEFAULT 'SCHOOL_SITE',
  "sourceUrl" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 60,
  "rawData" JSONB,
  "reviewStatus" "AcademicSchoolMajorReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" VARCHAR(100),
  "reviewedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_school_major_staging_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_school_majors_schoolCode_majorCode_educationLevel_key" ON "academic_school_majors"("schoolCode", "majorCode", "educationLevel");
CREATE INDEX "academic_school_majors_schoolId_status_idx" ON "academic_school_majors"("schoolId", "status");
CREATE INDEX "academic_school_majors_schoolCode_collegeName_idx" ON "academic_school_majors"("schoolCode", "collegeName");
CREATE INDEX "academic_school_majors_majorCode_educationLevel_idx" ON "academic_school_majors"("majorCode", "educationLevel");
CREATE INDEX "academic_school_major_staging_schoolCode_reviewStatus_idx" ON "academic_school_major_staging"("schoolCode", "reviewStatus");
CREATE INDEX "academic_school_major_staging_majorCode_educationLevel_idx" ON "academic_school_major_staging"("majorCode", "educationLevel");
CREATE INDEX "academic_school_major_staging_reviewStatus_confidence_idx" ON "academic_school_major_staging"("reviewStatus", "confidence");

ALTER TABLE "academic_school_majors" ADD CONSTRAINT "academic_school_majors_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "AcademicSchool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
