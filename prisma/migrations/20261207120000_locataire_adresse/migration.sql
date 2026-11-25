-- Locataire : adresse actuelle (section A du bail)
ALTER TABLE "LocataireImmo" ADD COLUMN "adresse" TEXT;
ALTER TABLE "LocataireImmo" ADD COLUMN "appartement" TEXT;
ALTER TABLE "LocataireImmo" ADD COLUMN "ville" TEXT;
ALTER TABLE "LocataireImmo" ADD COLUMN "codePostal" TEXT;
