-- VR Premium : la table "Vehicule" existe déjà (0_init_vr_premium) et
-- contient des véhicules réels — on la convertit au format du dossier
-- véhicule au lieu de la créer. Aucune donnée n'est perdue.

-- « vin » devient « niv », marque et modèle deviennent optionnels (listes
-- du catalogue ou « Autre… »), ajout de la version et de la date d'ajout
ALTER TABLE "Vehicule" RENAME COLUMN "vin" TO "niv";
ALTER TABLE "Vehicule" ALTER COLUMN "marque" DROP NOT NULL,
ALTER COLUMN "modele" DROP NOT NULL;
ALTER TABLE "Vehicule" ADD COLUMN "version" TEXT,
ADD COLUMN "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- NIV et plaque au même format que les nouvelles saisies (majuscules,
-- sans espaces dans le NIV)
UPDATE "Vehicule" SET "niv" = NULLIF(UPPER(REGEXP_REPLACE("niv", '[[:space:]-]', '', 'g')), '');
UPDATE "Vehicule" SET "plaque" = NULLIF(UPPER(BTRIM(REGEXP_REPLACE("plaque", '[[:space:]]+', ' ', 'g'))), '');

-- Les véhicules suivent leur client (comme le dossier véhicule du modèle
-- de base) ; la suppression d'un client avec des bons reste bloquée par
-- l'application
ALTER TABLE "Vehicule" DROP CONSTRAINT "Vehicule_clientId_fkey";
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- "BonTravail"."vehiculeId" et sa clé étrangère existent déjà (ON DELETE SET NULL)

-- AlterTable
ALTER TABLE "RendezVous" ADD COLUMN "vehiculeDetails" JSONB;

-- CreateIndex
CREATE INDEX "Vehicule_clientId_idx" ON "Vehicule"("clientId");

-- CreateIndex
CREATE INDEX "Vehicule_niv_idx" ON "Vehicule"("niv");

-- CreateIndex
CREATE INDEX "Vehicule_plaque_idx" ON "Vehicule"("plaque");
