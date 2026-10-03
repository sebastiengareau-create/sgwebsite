-- Véhicules à vendre (profil vehiculesAVendre) : fiche d'un véhicule qui
-- appartient à l'entreprise, bons internes reliés (leur montant s'ajoute au
-- coûtant du véhicule) et facture de vente du véhicule à un client.
-- Tables vides et colonne facultative : sans effet pour les autres clients.

-- AlterTable
ALTER TABLE "BonTravail" ADD COLUMN     "vehiculeVenteId" TEXT;

-- CreateTable
CREATE TABLE "VehiculeVente" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "vehiculeId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_STOCK',
    "coutantAchat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prixDemande" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dateAchat" TIMESTAMP(3),
    "provenance" TEXT,
    "kilometrage" INTEGER,
    "description" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiculeVente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactureVente" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "vehiculeVenteId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'IMPAYEE',
    "prixVente" DOUBLE PRECISION NOT NULL,
    "tpsMontant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tvqMontant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAvecTaxes" DOUBLE PRECISION NOT NULL,
    "coutantVehicule" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datePaiement" TIMESTAMP(3),
    "modePaiement" TEXT,
    "compteTresorerieId" TEXT,
    "referenceVersement" TEXT,
    "creePar" TEXT,

    CONSTRAINT "FactureVente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehiculeVente_numero_key" ON "VehiculeVente"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "VehiculeVente_vehiculeId_key" ON "VehiculeVente"("vehiculeId");

-- CreateIndex
CREATE UNIQUE INDEX "FactureVente_numero_key" ON "FactureVente"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "FactureVente_vehiculeVenteId_key" ON "FactureVente"("vehiculeVenteId");

-- CreateIndex
CREATE INDEX "BonTravail_vehiculeVenteId_idx" ON "BonTravail"("vehiculeVenteId");

-- AddForeignKey
ALTER TABLE "BonTravail" ADD CONSTRAINT "BonTravail_vehiculeVenteId_fkey" FOREIGN KEY ("vehiculeVenteId") REFERENCES "VehiculeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiculeVente" ADD CONSTRAINT "VehiculeVente_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "Vehicule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureVente" ADD CONSTRAINT "FactureVente_vehiculeVenteId_fkey" FOREIGN KEY ("vehiculeVenteId") REFERENCES "VehiculeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureVente" ADD CONSTRAINT "FactureVente_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureVente" ADD CONSTRAINT "FactureVente_compteTresorerieId_fkey" FOREIGN KEY ("compteTresorerieId") REFERENCES "CompteTresorerie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

