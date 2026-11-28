-- Adresses de l'Immobilier et de la Copropriété au format de l'appli
-- (adresse, ville, province, code postal) : colonnes ajoutées seulement
ALTER TABLE "ImmeubleImmo" ADD COLUMN "province" TEXT;
ALTER TABLE "LocataireImmo" ADD COLUMN "province" TEXT;
ALTER TABLE "BatimentCopro" ADD COLUMN "ville" TEXT;
ALTER TABLE "BatimentCopro" ADD COLUMN "province" TEXT;
ALTER TABLE "BatimentCopro" ADD COLUMN "codePostal" TEXT;
ALTER TABLE "CoproprietaireCopro" ADD COLUMN "ville" TEXT;
ALTER TABLE "CoproprietaireCopro" ADD COLUMN "province" TEXT;
ALTER TABLE "CoproprietaireCopro" ADD COLUMN "codePostal" TEXT;
