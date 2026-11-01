-- Pièce de l'inventaire proposée sur une soumission (sans toucher au stock :
-- elle en sort quand la soumission devient un bon ou une facture)
ALTER TABLE "PieceEstimee" ADD COLUMN "pieceId" TEXT;
CREATE INDEX "PieceEstimee_pieceId_idx" ON "PieceEstimee"("pieceId");
ALTER TABLE "PieceEstimee" ADD CONSTRAINT "PieceEstimee_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE SET NULL ON UPDATE CASCADE;
