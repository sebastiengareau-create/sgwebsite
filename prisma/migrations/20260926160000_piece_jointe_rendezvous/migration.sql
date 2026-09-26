-- AlterTable
ALTER TABLE "RendezVous" ADD COLUMN     "pieceJointe" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "piecesJointes" TEXT[] DEFAULT ARRAY[]::TEXT[];
