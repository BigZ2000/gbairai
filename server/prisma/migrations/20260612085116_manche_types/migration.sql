-- Filtre de types de questions par manche (vide = tous les types).
ALTER TABLE "Manche" ADD COLUMN "typesAutorises" TEXT[] DEFAULT ARRAY[]::TEXT[];
