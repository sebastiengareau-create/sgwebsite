-- Adresse complète d'un nouveau client entrée sur une soumission (comme sur
-- un bon) — versée à son dossier si la soumission devient un bon
ALTER TABLE "Soumission" ADD COLUMN "clientAdresse" TEXT;
ALTER TABLE "Soumission" ADD COLUMN "clientVille" TEXT;
ALTER TABLE "Soumission" ADD COLUMN "clientProvince" TEXT;
ALTER TABLE "Soumission" ADD COLUMN "clientCodePostal" TEXT;
