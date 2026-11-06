-- Retour d'une pièce hors inventaire (lib/retours.js) : ligne fixe négative
-- reliée à la ligne vendue, et fiche d'inventaire où la pièce est remise.
-- AlterTable
ALTER TABLE "Probleme" ADD COLUMN     "defectueuse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retourDeProblemeId" TEXT,
ADD COLUMN     "retourFacture" TEXT,
ADD COLUMN     "retourPieceId" TEXT;

-- CreateIndex
CREATE INDEX "Probleme_retourDeProblemeId_idx" ON "Probleme"("retourDeProblemeId");

-- AddForeignKey
ALTER TABLE "Probleme" ADD CONSTRAINT "Probleme_retourDeProblemeId_fkey" FOREIGN KEY ("retourDeProblemeId") REFERENCES "Probleme"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Probleme" ADD CONSTRAINT "Probleme_retourPieceId_fkey" FOREIGN KEY ("retourPieceId") REFERENCES "Piece"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

