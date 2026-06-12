-- DropIndex
DROP INDEX "Question_subjectKey_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetCode" TEXT,
ADD COLUMN     "resetExpiry" TIMESTAMP(3);
