-- AlterTable
ALTER TABLE "Facture" ADD COLUMN     "jetonPaiement" TEXT;

-- CreateTable
CREATE TABLE "PaiementEnLigne" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "factureId" TEXT,
    "soumissionId" TEXT,
    "bonId" TEXT,
    "inspectionId" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'OUVERT',
    "paymentIntentId" TEXT,
    "fraisStripe" DOUBLE PRECISION,
    "payeLe" TIMESTAMP(3),
    "paiementFactureId" TEXT,
    "depotId" TEXT,
    "erreur" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementEnLigne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaiementEnLigne_sessionId_key" ON "PaiementEnLigne"("sessionId");

-- CreateIndex
CREATE INDEX "PaiementEnLigne_factureId_idx" ON "PaiementEnLigne"("factureId");

-- CreateIndex
CREATE INDEX "PaiementEnLigne_soumissionId_idx" ON "PaiementEnLigne"("soumissionId");

-- CreateIndex
CREATE INDEX "PaiementEnLigne_bonId_idx" ON "PaiementEnLigne"("bonId");

-- CreateIndex
CREATE INDEX "PaiementEnLigne_statut_idx" ON "PaiementEnLigne"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Facture_jetonPaiement_key" ON "Facture"("jetonPaiement");

