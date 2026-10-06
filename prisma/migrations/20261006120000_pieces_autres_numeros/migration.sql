-- Autres numéros d'une pièce (UGS du fichier d'import, anciens numéros…) :
-- trouvés en recherche et au scan comme le numéro de référence.
-- Colonne vide par défaut : sans effet pour les pièces existantes.

-- AlterTable
ALTER TABLE "Piece" ADD COLUMN     "autresNumeros" TEXT[] DEFAULT ARRAY[]::TEXT[];
