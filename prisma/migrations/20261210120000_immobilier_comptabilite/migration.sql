-- Immobilier relié à la comptabilité (lib/immobilierCompta.js) : colonnes facultatives,
-- vides tant que le lien n'est pas activé
-- AlterTable
ALTER TABLE "Depense" ADD COLUMN     "origine" TEXT,
ADD COLUMN     "origineId" TEXT;

-- AlterTable
ALTER TABLE "DepenseImmo" ADD COLUMN     "fournisseurId" TEXT;

-- AlterTable
ALTER TABLE "ReparationImmo" ADD COLUMN     "fournisseurId" TEXT;

-- CreateIndex
CREATE INDEX "Depense_origine_origineId_idx" ON "Depense"("origine", "origineId");

-- AddForeignKey
ALTER TABLE "DepenseImmo" ADD CONSTRAINT "DepenseImmo_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReparationImmo" ADD CONSTRAINT "ReparationImmo_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

