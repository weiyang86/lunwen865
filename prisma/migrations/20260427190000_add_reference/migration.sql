-- CreateEnum
CREATE TYPE "RefType" AS ENUM (
  'JOURNAL',
  'BOOK',
  'THESIS',
  'CONFERENCE',
  'STANDARD',
  'PATENT',
  'WEB',
  'NEWSPAPER',
  'REPORT'
);

-- CreateEnum
CREATE TYPE "RefSource" AS ENUM ('AI_GENERATED', 'MANUAL', 'CROSSREF', 'CNKI');

-- CreateTable
CREATE TABLE "Reference" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "type" "RefType" NOT NULL,
  "title" TEXT NOT NULL,
  "authors" TEXT NOT NULL,
  "year" INTEGER,
  "journal" TEXT,
  "volume" TEXT,
  "issue" TEXT,
  "pages" TEXT,
  "publisher" TEXT,
  "city" TEXT,
  "university" TEXT,
  "degree" TEXT,
  "url" TEXT,
  "accessDate" TIMESTAMP(3),
  "doi" TEXT,
  "isbn" TEXT,
  "source" "RefSource" NOT NULL DEFAULT 'AI_GENERATED',
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "citedInSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "citedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reference_taskId_idx" ON "Reference"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Reference_taskId_index_key" ON "Reference"("taskId", "index");

-- AddForeignKey
ALTER TABLE "Reference"
ADD CONSTRAINT "Reference_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

