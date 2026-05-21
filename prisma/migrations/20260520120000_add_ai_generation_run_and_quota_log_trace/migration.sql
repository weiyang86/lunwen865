-- add traceability columns for quota logs
ALTER TABLE "QuotaLog"
  ADD COLUMN "relatedTaskId" TEXT,
  ADD COLUMN "relatedStageKey" VARCHAR(40),
  ADD COLUMN "relatedGenerationRunId" VARCHAR(50),
  ADD COLUMN "idempotencyKey" VARCHAR(100),
  ADD COLUMN "balanceBefore" INTEGER;

CREATE INDEX "QuotaLog_relatedTaskId_createdAt_idx" ON "QuotaLog"("relatedTaskId", "createdAt");
CREATE INDEX "QuotaLog_relatedGenerationRunId_idx" ON "QuotaLog"("relatedGenerationRunId");
CREATE INDEX "QuotaLog_idempotencyKey_idx" ON "QuotaLog"("idempotencyKey");

-- ai generation run audit table
CREATE TABLE "AiGenerationRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "stageKey" VARCHAR(40) NOT NULL,
  "actionKey" VARCHAR(50) NOT NULL,
  "sceneKey" VARCHAR(80) NOT NULL,
  "status" VARCHAR(30) NOT NULL,
  "costBrainCells" INTEGER NOT NULL DEFAULT 0,
  "inputSnapshot" JSONB,
  "outputSnapshot" JSONB,
  "errorMessage" TEXT,
  "idempotencyKey" VARCHAR(100),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiGenerationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiGenerationRun_userId_createdAt_idx" ON "AiGenerationRun"("userId", "createdAt");
CREATE INDEX "AiGenerationRun_taskId_createdAt_idx" ON "AiGenerationRun"("taskId", "createdAt");
CREATE INDEX "AiGenerationRun_stageKey_createdAt_idx" ON "AiGenerationRun"("stageKey", "createdAt");
CREATE INDEX "AiGenerationRun_status_createdAt_idx" ON "AiGenerationRun"("status", "createdAt");

ALTER TABLE "AiGenerationRun" ADD CONSTRAINT "AiGenerationRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiGenerationRun" ADD CONSTRAINT "AiGenerationRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
