-- Facture comptoir : bon sans véhicule ni main-d'œuvre (lib/comptoir.js)
ALTER TABLE "BonTravail" ADD COLUMN     "comptoir" BOOLEAN NOT NULL DEFAULT false;
