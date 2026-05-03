-- CreateEnum
CREATE TYPE "TaskAdminAction" AS ENUM ('ASSIGN', 'UNASSIGN', 'OVERRIDE_STATUS', 'ADD_NOTE', 'LINK_ORDER', 'UNLINK_ORDER');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "assigneeId" TEXT;

-- CreateTable
CREATE TABLE "TaskAdminLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "action" "TaskAdminAction" NOT NULL,
    "operatorId" TEXT NOT NULL,
    "fromStatus" "TaskStatus",
    "toStatus" "TaskStatus",
    "assigneeId" TEXT,
    "orderId" TEXT,
    "reason" VARCHAR(500),
    "content" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskAdminLog_taskId_createdAt_idx" ON "TaskAdminLog"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskAdminLog_operatorId_createdAt_idx" ON "TaskAdminLog"("operatorId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskAdminLog_action_createdAt_idx" ON "TaskAdminLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "TaskAdminLog_assigneeId_idx" ON "TaskAdminLog"("assigneeId");

-- CreateIndex
CREATE INDEX "TaskAdminLog_orderId_idx" ON "TaskAdminLog"("orderId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAdminLog" ADD CONSTRAINT "TaskAdminLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAdminLog" ADD CONSTRAINT "TaskAdminLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
