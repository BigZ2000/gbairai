-- AlterTable
ALTER TABLE "Pack" ADD COLUMN     "origine" TEXT,
ADD COLUMN     "ownerId" TEXT;

-- CreateTable
CREATE TABLE "AiGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fournisseur" TEXT NOT NULL,
    "modele" TEXT NOT NULL,
    "demande" TEXT NOT NULL,
    "nbQuestions" INTEGER NOT NULL DEFAULT 0,
    "jetonsEntree" INTEGER NOT NULL DEFAULT 0,
    "jetonsSortie" INTEGER NOT NULL DEFAULT 0,
    "coutEstimeUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL,
    "erreur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiGeneration_userId_createdAt_idx" ON "AiGeneration"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiGeneration_createdAt_idx" ON "AiGeneration"("createdAt");

-- CreateIndex
CREATE INDEX "Pack_ownerId_idx" ON "Pack"("ownerId");

-- AddForeignKey
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
