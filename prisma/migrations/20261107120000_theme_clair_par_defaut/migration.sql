-- Affichage clair par défaut, et tout le monde passe en clair (une seule fois :
-- chacun peut ensuite être remis en sombre dans sa fiche employé).
ALTER TABLE "User" ALTER COLUMN "theme" SET DEFAULT 'clair';
UPDATE "User" SET "theme" = 'clair' WHERE "theme" <> 'clair';
-- Affichage du développeur (Administrateur → Affichage).
UPDATE "Parametre" SET "valeur" = 'clair' WHERE "cle" = 'theme_developpeur';
