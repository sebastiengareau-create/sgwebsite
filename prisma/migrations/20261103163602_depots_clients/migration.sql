-- CreateTable
CREATE TABLE "DepotClient" (
    "id" TEXT NOT NULL,
    "soumissionId" TEXT,
    "bonId" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "modePaiement" TEXT,
    "compteTresorerieId" TEXT NOT NULL,
    "reference" TEXT,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ecritureId" TEXT,
    "paiementFactureId" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepotClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepotClient_paiementFactureId_key" ON "DepotClient"("paiementFactureId");

-- CreateIndex
CREATE INDEX "DepotClient_soumissionId_idx" ON "DepotClient"("soumissionId");

-- CreateIndex
CREATE INDEX "DepotClient_bonId_idx" ON "DepotClient"("bonId");

-- AddForeignKey
ALTER TABLE "DepotClient" ADD CONSTRAINT "DepotClient_soumissionId_fkey" FOREIGN KEY ("soumissionId") REFERENCES "Soumission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepotClient" ADD CONSTRAINT "DepotClient_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonTravail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepotClient" ADD CONSTRAINT "DepotClient_compteTresorerieId_fkey" FOREIGN KEY ("compteTresorerieId") REFERENCES "CompteTresorerie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepotClient" ADD CONSTRAINT "DepotClient_paiementFactureId_fkey" FOREIGN KEY ("paiementFactureId") REFERENCES "PaiementFacture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

