-- AlterTable
ALTER TABLE "BonTravail" ADD COLUMN "kilometrage" INTEGER;

-- Bons pas encore facturés : reprennent le kilométrage actuel de leur
-- véhicule (les factures déjà émises restent sans kilométrage)
UPDATE "BonTravail" b SET "kilometrage" = v."kilometrage"
FROM "Vehicule" v
WHERE b."vehiculeId" = v."id"
  AND v."kilometrage" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Facture" f WHERE f."bonId" = b."id");
