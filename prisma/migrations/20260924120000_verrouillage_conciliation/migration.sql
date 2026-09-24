-- AlterTable
ALTER TABLE "LigneEcriture" ADD COLUMN     "rapprochementId" TEXT;

-- CreateIndex
CREATE INDEX "LigneEcriture_rapprochementId_idx" ON "LigneEcriture"("rapprochementId");

-- AddForeignKey
ALTER TABLE "LigneEcriture" ADD CONSTRAINT "LigneEcriture_rapprochementId_fkey" FOREIGN KEY ("rapprochementId") REFERENCES "RapprochementBancaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
