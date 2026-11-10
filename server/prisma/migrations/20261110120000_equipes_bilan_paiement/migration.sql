-- Jeu par équipes
ALTER TABLE "Partie" ADD COLUMN "equipes" JSONB;
ALTER TABLE "Participant" ADD COLUMN "equipe" INTEGER;

-- Logo d'organisation (branding)
ALTER TABLE "Organisation" ADD COLUMN "logoUrl" TEXT;

-- Images personnelles des utilisateurs (hors médiathèque publique)
ALTER TABLE "Media" ADD COLUMN "prive" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Media_prive_createdById_idx" ON "Media"("prive", "createdById");

-- Paiement réel CinetPay
ALTER TABLE "Paiement" ADD COLUMN "notifyToken" TEXT;
ALTER TABLE "Paiement" ADD COLUMN "paymentUrl" TEXT;
