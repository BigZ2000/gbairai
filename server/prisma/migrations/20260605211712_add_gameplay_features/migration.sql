-- AlterTable
ALTER TABLE "Manche" ADD COLUMN     "eliminationActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "malusEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "malusPenalite" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "multiplicateurPoints" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "Pack" ADD COLUMN     "eliminationActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "malusEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "malusPenalite" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "modeDistanciel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "multiplicateurFinale" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "isEliminated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Partie" ADD COLUMN     "eliminationActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modeDistanciel" BOOLEAN NOT NULL DEFAULT false;
