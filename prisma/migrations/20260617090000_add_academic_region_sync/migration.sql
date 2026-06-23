CREATE TYPE "AcademicRegionLevel" AS ENUM ('PROVINCE', 'CITY', 'DISTRICT');
CREATE TYPE "AcademicRegionStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "AcademicRegionSource" AS ENUM ('AMAP', 'MANUAL');
CREATE TYPE "AcademicRegionReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "AcademicSyncJobType" AS ENUM ('REGION_AMAP');
CREATE TYPE "AcademicSyncSource" AS ENUM ('AMAP');
CREATE TYPE "AcademicSyncScope" AS ENUM ('NATIONAL', 'SOUTHWEST', 'CUSTOM');
CREATE TYPE "AcademicSyncJobStatus" AS ENUM ('IDLE', 'RUNNING', 'SUCCESS', 'FAILED');
CREATE TYPE "AcademicSyncLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

CREATE TABLE "academic_regions" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "level" "AcademicRegionLevel" NOT NULL,
  "parentCode" VARCHAR(20),
  "status" "AcademicRegionStatus" NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "source" "AcademicRegionSource" NOT NULL DEFAULT 'AMAP',
  "sourceVersion" VARCHAR(80),
  "sourceUrl" TEXT,
  "syncKey" VARCHAR(120),
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "lastSyncedAt" TIMESTAMP(3),
  "reviewStatus" "AcademicRegionReviewStatus" NOT NULL DEFAULT 'APPROVED',
  "reviewedBy" VARCHAR(100),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_regions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "academic_regions_code_key" ON "academic_regions"("code");
CREATE INDEX "academic_regions_level_status_sortOrder_idx" ON "academic_regions"("level", "status", "sortOrder");
CREATE INDEX "academic_regions_parentCode_idx" ON "academic_regions"("parentCode");

CREATE TABLE "academic_sync_jobs" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "type" "AcademicSyncJobType" NOT NULL,
  "source" "AcademicSyncSource" NOT NULL DEFAULT 'AMAP',
  "scope" "AcademicSyncScope" NOT NULL DEFAULT 'NATIONAL',
  "status" "AcademicSyncJobStatus" NOT NULL DEFAULT 'IDLE',
  "lastRunAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_sync_jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "academic_sync_jobs_type_scope_key" ON "academic_sync_jobs"("type", "scope");
CREATE INDEX "academic_sync_jobs_type_status_idx" ON "academic_sync_jobs"("type", "status");

CREATE TABLE "academic_sync_logs" (
  "id" TEXT NOT NULL,
  "jobId" TEXT,
  "level" "AcademicSyncLogLevel" NOT NULL DEFAULT 'INFO',
  "message" VARCHAR(500) NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "academic_sync_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "academic_sync_logs_jobId_createdAt_idx" ON "academic_sync_logs"("jobId", "createdAt");
CREATE INDEX "academic_sync_logs_level_createdAt_idx" ON "academic_sync_logs"("level", "createdAt");
ALTER TABLE "academic_sync_logs" ADD CONSTRAINT "academic_sync_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "academic_sync_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
