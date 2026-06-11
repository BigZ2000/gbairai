-- Mode « vies » : -1 vie sur mauvaise réponse, éliminé à 0.
ALTER TABLE "Partie" ADD COLUMN "viesParJoueur" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Participant" ADD COLUMN "vies" INTEGER;
