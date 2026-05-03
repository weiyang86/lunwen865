-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'TUTOR';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "primaryTutorId" TEXT;

-- CreateIndex
CREATE INDEX "Order_primaryTutorId_idx" ON "Order"("primaryTutorId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_primaryTutorId_fkey" FOREIGN KEY ("primaryTutorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
