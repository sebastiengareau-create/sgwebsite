-- AlterTable
ALTER TABLE "PieceUtilisee" ADD COLUMN     "coutant" DOUBLE PRECISION;

-- Lignes existantes : meilleur coût connu = coût moyen actuel de la pièce
UPDATE "PieceUtilisee" pu
SET "coutant" = p."coutant"
FROM "Piece" p
WHERE pu."pieceId" = p."id" AND pu."coutant" IS NULL;
