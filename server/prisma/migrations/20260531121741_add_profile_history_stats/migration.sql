-- AlterTable
ALTER TABLE "Partie" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "packId" TEXT,
ADD COLUMN     "packNom" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Question" ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "ip" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "langue" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "nom" TEXT,
ADD COLUMN     "telephone" TEXT,
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'dark';

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "partieId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "questionId" TEXT,
    "participantId" TEXT,
    "type" TEXT NOT NULL,
    "valide" BOOLEAN,
    "responseMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameEvent_partieId_idx" ON "GameEvent"("partieId");

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_partieId_fkey" FOREIGN KEY ("partieId") REFERENCES "Partie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
