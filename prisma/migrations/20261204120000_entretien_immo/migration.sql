-- AlterTable
ALTER TABLE "ReparationImmo" ADD COLUMN     "entretienId" TEXT;

-- CreateTable
CREATE TABLE "EntretienImmo" (
    "id" TEXT NOT NULL,
    "immeubleId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ENTRETIEN',
    "categorie" TEXT,
    "frequenceMois" INTEGER NOT NULL DEFAULT 12,
    "prochaineDate" TIMESTAMP(3) NOT NULL,
    "derniereDate" TIMESTAMP(3),
    "entrepreneur" TEXT,
    "telephoneEntrepreneur" TEXT,
    "coutEstime" DOUBLE PRECISION,
    "obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "dansLogements" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntretienImmo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntretienImmo_prochaineDate_idx" ON "EntretienImmo"("prochaineDate");

-- CreateIndex
CREATE INDEX "EntretienImmo_immeubleId_idx" ON "EntretienImmo"("immeubleId");

-- AddForeignKey
ALTER TABLE "ReparationImmo" ADD CONSTRAINT "ReparationImmo_entretienId_fkey" FOREIGN KEY ("entretienId") REFERENCES "EntretienImmo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntretienImmo" ADD CONSTRAINT "EntretienImmo_immeubleId_fkey" FOREIGN KEY ("immeubleId") REFERENCES "ImmeubleImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

