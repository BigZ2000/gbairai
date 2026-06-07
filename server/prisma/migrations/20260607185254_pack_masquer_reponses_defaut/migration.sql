-- AlterTable
ALTER TABLE "Manche" ADD COLUMN     "typeManche" TEXT NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "Pack" ADD COLUMN     "masquerReponsesDefaut" BOOLEAN NOT NULL DEFAULT false;
