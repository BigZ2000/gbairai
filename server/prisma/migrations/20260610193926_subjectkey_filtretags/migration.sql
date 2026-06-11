-- Anti-doublon métier + filtrage par tags (packs transverses : drapeaux, régions…)
ALTER TABLE "Question" ADD COLUMN "subjectKey" TEXT;
CREATE INDEX "Question_subjectKey_idx" ON "Question"("subjectKey");
ALTER TABLE "Pack" ADD COLUMN "filtreTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
