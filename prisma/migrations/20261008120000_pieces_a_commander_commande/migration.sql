-- Pièces à commander d'un bon reliées à leur fiche d'inventaire et à la
-- commande fournisseur où elles ont été ajoutées (« 🛒 Commander »).
-- Colonnes facultatives : sans effet sur les données existantes.

-- AlterTable
ALTER TABLE "PieceACommander" ADD COLUMN     "commandeId" TEXT,
ADD COLUMN     "pieceId" TEXT;

-- AddForeignKey
ALTER TABLE "PieceACommander" ADD CONSTRAINT "PieceACommander_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceACommander" ADD CONSTRAINT "PieceACommander_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeFournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

