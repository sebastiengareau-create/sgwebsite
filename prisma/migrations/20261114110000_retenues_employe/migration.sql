-- AlterTable
ALTER TABLE "Paie" ADD COLUMN     "retenuesApresImpot" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "retenuesDeductibles" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "retenuesDetail" JSONB;

-- CreateTable
CREATE TABLE "RetenueEmploye" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'APRES_IMPOT',
    "montant" DOUBLE PRECISION NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetenueEmploye_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetenueEmploye_employeId_idx" ON "RetenueEmploye"("employeId");

-- AddForeignKey
ALTER TABLE "RetenueEmploye" ADD CONSTRAINT "RetenueEmploye_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

