-- Crédit client (lib/creditClient.js) : trop-payés, excédents de dépôts,
-- crédit appliqué sur une facture (paiement sans compte de trésorerie)
-- et remboursements.
-- AlterTable
ALTER TABLE "PaiementFacture" ALTER COLUMN "compteTresorerieId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CreditClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "factureId" TEXT,
    "paiementFactureId" TEXT,
    "depotClientId" TEXT,
    "modePaiement" TEXT,
    "compteTresorerieId" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ecritureId" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditClient_paiementFactureId_key" ON "CreditClient"("paiementFactureId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditClient_depotClientId_key" ON "CreditClient"("depotClientId");

-- CreateIndex
CREATE INDEX "CreditClient_clientId_idx" ON "CreditClient"("clientId");

-- CreateIndex
CREATE INDEX "CreditClient_factureId_idx" ON "CreditClient"("factureId");

-- AddForeignKey
ALTER TABLE "CreditClient" ADD CONSTRAINT "CreditClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditClient" ADD CONSTRAINT "CreditClient_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditClient" ADD CONSTRAINT "CreditClient_paiementFactureId_fkey" FOREIGN KEY ("paiementFactureId") REFERENCES "PaiementFacture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditClient" ADD CONSTRAINT "CreditClient_depotClientId_fkey" FOREIGN KEY ("depotClientId") REFERENCES "DepotClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditClient" ADD CONSTRAINT "CreditClient_compteTresorerieId_fkey" FOREIGN KEY ("compteTresorerieId") REFERENCES "CompteTresorerie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

