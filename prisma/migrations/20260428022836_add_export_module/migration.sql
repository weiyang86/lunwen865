-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('DOCX', 'PDF');

-- CreateEnum
CREATE TYPE "ExportScope" AS ENUM ('OUTLINE_ONLY', 'FULL_PAPER', 'WITH_REVISIONS');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ExportTemplate" AS ENUM ('GENERIC', 'UNDERGRADUATE', 'MASTER', 'CUSTOM');

-- CreateTable
CREATE TABLE "ExportTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paperId" TEXT,
    "polishTaskId" TEXT,
    "sourceType" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL DEFAULT 'DOCX',
    "scope" "ExportScope" NOT NULL DEFAULT 'FULL_PAPER',
    "template" "ExportTemplate" NOT NULL DEFAULT 'GENERIC',
    "title" VARCHAR(255) NOT NULL,
    "author" VARCHAR(100),
    "school" VARCHAR(100),
    "major" VARCHAR(100),
    "studentId" VARCHAR(50),
    "advisor" VARCHAR(100),
    "abstract" TEXT,
    "keywords" VARCHAR(500),
    "contentSnapshot" JSONB,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "filePath" TEXT,
    "fileName" VARCHAR(255),
    "fileSize" INTEGER,
    "downloadUrl" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportTask_userId_createdAt_idx" ON "ExportTask"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExportTask_status_idx" ON "ExportTask"("status");

-- CreateIndex
CREATE INDEX "ExportTask_expiresAt_idx" ON "ExportTask"("expiresAt");

-- AddForeignKey
ALTER TABLE "ExportTask" ADD CONSTRAINT "ExportTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
