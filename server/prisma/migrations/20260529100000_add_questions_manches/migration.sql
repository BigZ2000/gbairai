-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('BUZZER', 'QCM', 'VRAI_FAUX', 'IMAGE', 'AUDIO');

-- CreateEnum
CREATE TYPE "Difficulte" AS ENUM ('FACILE', 'MOYEN', 'DIFFICILE');

-- AlterTable (remove legacy questions JSON column)
ALTER TABLE "Partie" DROP COLUMN IF EXISTS "questions";

-- CreateTable
CREATE TABLE "Categorie" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "emoji" TEXT,
    "description" TEXT,
    "publique" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubrique" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rubrique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "enonce" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'BUZZER',
    "reponse" TEXT NOT NULL,
    "indice" TEXT,
    "choix" TEXT[],
    "points" INTEGER NOT NULL DEFAULT 100,
    "tempsLimite" INTEGER NOT NULL DEFAULT 30,
    "mediaUrl" TEXT,
    "videoUrl" TEXT,
    "videoDebut" INTEGER,
    "videoFin" INTEGER,
    "difficulte" "Difficulte" NOT NULL DEFAULT 'MOYEN',
    "publique" BOOLEAN NOT NULL DEFAULT false,
    "categorieId" TEXT,
    "rubriqueId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manche" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "partieId" TEXT NOT NULL,
    "pointsParQ" INTEGER NOT NULL DEFAULT 100,
    "tempsLimite" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Manche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MancheQuestion" (
    "id" TEXT NOT NULL,
    "mancheId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MancheQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MancheQuestion_mancheId_ordre_key" ON "MancheQuestion"("mancheId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "MancheQuestion_mancheId_questionId_key" ON "MancheQuestion"("mancheId", "questionId");

-- AddForeignKey
ALTER TABLE "Rubrique" ADD CONSTRAINT "Rubrique_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_rubriqueId_fkey" FOREIGN KEY ("rubriqueId") REFERENCES "Rubrique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manche" ADD CONSTRAINT "Manche_partieId_fkey" FOREIGN KEY ("partieId") REFERENCES "Partie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MancheQuestion" ADD CONSTRAINT "MancheQuestion_mancheId_fkey" FOREIGN KEY ("mancheId") REFERENCES "Manche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MancheQuestion" ADD CONSTRAINT "MancheQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
