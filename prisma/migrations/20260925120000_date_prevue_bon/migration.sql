-- AlterTable
ALTER TABLE "BonTravail" ADD COLUMN "datePrevue" TIMESTAMP(3);

-- Les bons déjà créés depuis le calendrier prennent la date de leur rendez-vous
UPDATE "BonTravail" b SET "datePrevue" = r."date" FROM "RendezVous" r WHERE r."bonId" = b."id";
