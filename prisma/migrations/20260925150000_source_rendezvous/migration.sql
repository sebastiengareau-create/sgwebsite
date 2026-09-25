-- AlterTable
ALTER TABLE "RendezVous" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'LOCAL';

-- Les rendez-vous reçus du site de réservation portent une référence externe
UPDATE "RendezVous" SET "source" = 'WEB' WHERE "referenceExterne" IS NOT NULL;
