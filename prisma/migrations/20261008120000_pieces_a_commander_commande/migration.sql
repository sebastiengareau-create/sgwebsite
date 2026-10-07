-- Pièces à commander d'un bon reliées à leur fiche d'inventaire, à la
-- commande fournisseur où elles ont été ajoutées (« 🛒 Commander ») et à la
-- ligne ajoutée au bon. Une pièce d'un bon peut être B/O (commandée, pas
-- encore reçue). Colonnes facultatives ou à faux par défaut : sans effet
-- sur les données existantes.

-- AlterTable
ALTER TABLE "PieceACommander" ADD COLUMN     "commandeId" TEXT,
ADD COLUMN     "pieceId" TEXT,
ADD COLUMN     "pieceUtiliseeId" TEXT;

-- AlterTable
ALTER TABLE "PieceUtilisee" ADD COLUMN     "bo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "PieceACommander_pieceUtiliseeId_key" ON "PieceACommander"("pieceUtiliseeId");

-- AddForeignKey
ALTER TABLE "PieceACommander" ADD CONSTRAINT "PieceACommander_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceACommander" ADD CONSTRAINT "PieceACommander_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeFournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceACommander" ADD CONSTRAINT "PieceACommander_pieceUtiliseeId_fkey" FOREIGN KEY ("pieceUtiliseeId") REFERENCES "PieceUtilisee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

