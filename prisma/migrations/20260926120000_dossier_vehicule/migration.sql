-- CreateTable
CREATE TABLE "Vehicule" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "annee" INTEGER,
    "marque" TEXT,
    "modele" TEXT,
    "version" TEXT,
    "niv" TEXT,
    "plaque" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicule_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "BonTravail" ADD COLUMN "vehiculeId" TEXT;

-- AlterTable
ALTER TABLE "RendezVous" ADD COLUMN "vehiculeDetails" JSONB;

-- CreateIndex
CREATE INDEX "Vehicule_clientId_idx" ON "Vehicule"("clientId");

-- CreateIndex
CREATE INDEX "Vehicule_niv_idx" ON "Vehicule"("niv");

-- CreateIndex
CREATE INDEX "Vehicule_plaque_idx" ON "Vehicule"("plaque");

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonTravail" ADD CONSTRAINT "BonTravail_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "Vehicule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
