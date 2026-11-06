-- Retour de pièce (lib/retours.js) : ligne de bon en quantité négative
-- reliée à la ligne vendue d'origine.
-- AlterTable
ALTER TABLE "PieceUtilisee" ADD COLUMN     "defectueuse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retourDeId" TEXT,
ADD COLUMN     "retourFacture" TEXT;

-- CreateIndex
CREATE INDEX "PieceUtilisee_retourDeId_idx" ON "PieceUtilisee"("retourDeId");

-- AddForeignKey
ALTER TABLE "PieceUtilisee" ADD CONSTRAINT "PieceUtilisee_retourDeId_fkey" FOREIGN KEY ("retourDeId") REFERENCES "PieceUtilisee"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

