CREATE TYPE "AcademicCatalogSource" AS ENUM ('MOE', 'DEGREE_COMMITTEE', 'MANUAL');
CREATE TYPE "AcademicCatalogReviewStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');
CREATE TYPE "AcademicDisciplineCatalogLevel" AS ENUM ('DISCIPLINE_CATEGORY', 'FIRST_LEVEL_DISCIPLINE', 'SECOND_LEVEL_DISCIPLINE', 'PROFESSIONAL_DEGREE');
CREATE TYPE "AcademicDisciplineCatalogType" AS ENUM ('ACADEMIC', 'PROFESSIONAL');

CREATE TABLE "academic_catalog_majors" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "categoryCode" VARCHAR(50),
  "categoryName" VARCHAR(100),
  "disciplineCode" VARCHAR(50),
  "disciplineName" VARCHAR(100),
  "educationLevel" VARCHAR(40) NOT NULL,
  "degree" VARCHAR(80),
  "years" VARCHAR(40),
  "status" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" VARCHAR(40),
  "source" "AcademicCatalogSource" NOT NULL DEFAULT 'MOE',
  "sourceVersion" VARCHAR(80),
  "sourceUrl" TEXT,
  "syncKey" VARCHAR(120),
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "lastSyncedAt" TIMESTAMP(3),
  "reviewStatus" "AcademicCatalogReviewStatus" NOT NULL DEFAULT 'APPROVED',
  "reviewedBy" VARCHAR(100),
  "reviewedAt" TIMESTAMP(3),
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_catalog_majors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "academic_catalog_majors_code_key" ON "academic_catalog_majors"("code");
CREATE INDEX "academic_catalog_majors_disciplineName_idx" ON "academic_catalog_majors"("disciplineName");
CREATE INDEX "academic_catalog_majors_categoryName_idx" ON "academic_catalog_majors"("categoryName");
CREATE INDEX "academic_catalog_majors_educationLevel_status_idx" ON "academic_catalog_majors"("educationLevel", "status");

CREATE TABLE "academic_disciplines" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "parentCode" VARCHAR(50),
  "level" "AcademicDisciplineCatalogLevel" NOT NULL,
  "type" "AcademicDisciplineCatalogType" NOT NULL,
  "educationLevels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" VARCHAR(40),
  "source" "AcademicCatalogSource" NOT NULL DEFAULT 'MOE',
  "sourceVersion" VARCHAR(80),
  "sourceUrl" TEXT,
  "syncKey" VARCHAR(120),
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "lastSyncedAt" TIMESTAMP(3),
  "reviewStatus" "AcademicCatalogReviewStatus" NOT NULL DEFAULT 'APPROVED',
  "reviewedBy" VARCHAR(100),
  "reviewedAt" TIMESTAMP(3),
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_disciplines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "academic_disciplines_code_key" ON "academic_disciplines"("code");
CREATE INDEX "academic_disciplines_parentCode_idx" ON "academic_disciplines"("parentCode");
CREATE INDEX "academic_disciplines_level_type_idx" ON "academic_disciplines"("level", "type");
CREATE INDEX "academic_disciplines_status_idx" ON "academic_disciplines"("status");
