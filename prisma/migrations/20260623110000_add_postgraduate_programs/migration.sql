-- AcademicData-06: postgraduate admission programs and staging review workflow.
CREATE TYPE "AcademicPostgraduateProgramType" AS ENUM ('ACADEMIC', 'PROFESSIONAL');
CREATE TYPE "AcademicPostgraduateDegreeLevel" AS ENUM ('MASTER', 'DOCTOR');
CREATE TYPE "AcademicPostgraduateStudyMode" AS ENUM ('FULL_TIME', 'PART_TIME', 'UNKNOWN');
CREATE TYPE "AcademicPostgraduateProgramSource" AS ENUM ('YZ_CHSI', 'GRADUATE_SCHOOL', 'ADMISSION_BROCHURE', 'MANUAL');
CREATE TYPE "AcademicPostgraduateProgramReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "academic_postgraduate_programs" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "schoolCode" VARCHAR(50) NOT NULL,
  "schoolName" VARCHAR(150),
  "collegeId" TEXT,
  "collegeName" VARCHAR(150),
  "disciplineCode" VARCHAR(50),
  "disciplineName" VARCHAR(150),
  "programCode" VARCHAR(50) NOT NULL,
  "programName" VARCHAR(150) NOT NULL,
  "programType" "AcademicPostgraduateProgramType" NOT NULL,
  "degreeLevel" "AcademicPostgraduateDegreeLevel" NOT NULL,
  "researchDirection" VARCHAR(200),
  "studyMode" "AcademicPostgraduateStudyMode" NOT NULL DEFAULT 'UNKNOWN',
  "status" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "AcademicPostgraduateProgramSource" NOT NULL DEFAULT 'MANUAL',
  "sourceVersion" VARCHAR(80),
  "sourceUrl" TEXT,
  "syncKey" VARCHAR(260) NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 90,
  "lastSyncedAt" TIMESTAMP(3),
  "reviewStatus" "AcademicPostgraduateProgramReviewStatus" NOT NULL DEFAULT 'APPROVED',
  "reviewedBy" VARCHAR(100),
  "reviewedAt" TIMESTAMP(3),
  "remark" TEXT,
  "rawData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_postgraduate_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_postgraduate_program_staging" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "schoolCode" VARCHAR(50),
  "schoolName" VARCHAR(150),
  "collegeId" TEXT,
  "collegeName" VARCHAR(150),
  "disciplineCode" VARCHAR(50),
  "disciplineName" VARCHAR(150),
  "programCode" VARCHAR(50),
  "programName" VARCHAR(150) NOT NULL,
  "programType" "AcademicPostgraduateProgramType" NOT NULL,
  "degreeLevel" "AcademicPostgraduateDegreeLevel" NOT NULL,
  "researchDirection" VARCHAR(200),
  "studyMode" "AcademicPostgraduateStudyMode" NOT NULL DEFAULT 'UNKNOWN',
  "source" "AcademicPostgraduateProgramSource" NOT NULL DEFAULT 'GRADUATE_SCHOOL',
  "sourceUrl" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 60,
  "rawData" JSONB,
  "reviewStatus" "AcademicPostgraduateProgramReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" VARCHAR(100),
  "reviewedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_postgraduate_program_staging_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_postgraduate_programs_syncKey_key" ON "academic_postgraduate_programs"("syncKey");
CREATE INDEX "academic_postgraduate_programs_schoolCode_degreeLevel_idx" ON "academic_postgraduate_programs"("schoolCode", "degreeLevel");
CREATE INDEX "academic_postgraduate_programs_collegeName_idx" ON "academic_postgraduate_programs"("collegeName");
CREATE INDEX "academic_postgraduate_programs_disciplineCode_degreeLevel_idx" ON "academic_postgraduate_programs"("disciplineCode", "degreeLevel");
CREATE INDEX "academic_postgraduate_programs_programType_studyMode_idx" ON "academic_postgraduate_programs"("programType", "studyMode");
CREATE INDEX "academic_postgraduate_program_staging_schoolCode_reviewStatus_idx" ON "academic_postgraduate_program_staging"("schoolCode", "reviewStatus");
CREATE INDEX "academic_postgraduate_program_staging_disciplineCode_degreeLevel_idx" ON "academic_postgraduate_program_staging"("disciplineCode", "degreeLevel");
CREATE INDEX "academic_postgraduate_program_staging_programCode_degreeLevel_idx" ON "academic_postgraduate_program_staging"("programCode", "degreeLevel");
CREATE INDEX "academic_postgraduate_program_staging_reviewStatus_confidence_idx" ON "academic_postgraduate_program_staging"("reviewStatus", "confidence");

ALTER TABLE "academic_postgraduate_programs" ADD CONSTRAINT "academic_postgraduate_programs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "AcademicSchool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
