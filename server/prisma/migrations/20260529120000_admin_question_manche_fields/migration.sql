-- Add VIDEO to QuestionType enum
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'VIDEO';

-- Add isAdmin to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Add fields to Question
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "audioUrl" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "explication" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';

-- Add fields to Manche
ALTER TABLE "Manche" ADD COLUMN IF NOT EXISTS "theme" TEXT NOT NULL DEFAULT 'MELANGE';
ALTER TABLE "Manche" ADD COLUMN IF NOT EXISTS "difficulte" TEXT NOT NULL DEFAULT 'MIXTE';
ALTER TABLE "Manche" ADD COLUMN IF NOT EXISTS "nbQuestions" INTEGER NOT NULL DEFAULT 10;

-- Add unique constraint to Categorie.nom (safe: skip if already exists)
DO $$ BEGIN
  ALTER TABLE "Categorie" ADD CONSTRAINT "Categorie_nom_key" UNIQUE ("nom");
EXCEPTION WHEN duplicate_table THEN NULL;
WHEN duplicate_object THEN NULL;
END $$;
