-- Choix riches (texte et/ou image) pour les questions visuelles (drapeaux, logos…)
ALTER TABLE "Question" ADD COLUMN "choices" JSONB;
