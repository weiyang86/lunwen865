/*
  Warnings:

  - A unique constraint covering the columns `[taskId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "taskId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_taskId_key" ON "Order"("taskId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
