-- AlterTable
ALTER TABLE "DocumentImmo" ADD COLUMN     "visibleLocataire" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LocataireImmo" ADD COLUMN     "avisCourriel" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dernierAccesPortail" TIMESTAMP(3),
ADD COLUMN     "jetonPortail" TEXT;

-- AlterTable
ALTER TABLE "ReparationImmo" ADD COLUMN     "reponse" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'INTERNE';

-- CreateIndex
CREATE UNIQUE INDEX "LocataireImmo_jetonPortail_key" ON "LocataireImmo"("jetonPortail");

