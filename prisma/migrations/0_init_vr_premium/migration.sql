-- Tables propres à VR Premium (absentes de 0_init du template) : véhicules
-- AlterTable
ALTER TABLE "BonTravail" ADD COLUMN     "vehiculeId" TEXT;

-- CreateTable
CREATE TABLE "Vehicule" (
    "id" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "modele" TEXT NOT NULL,
    "annee" INTEGER,
    "vin" TEXT,
    "plaque" TEXT,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "Vehicule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonTravail" ADD CONSTRAINT "BonTravail_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "Vehicule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

