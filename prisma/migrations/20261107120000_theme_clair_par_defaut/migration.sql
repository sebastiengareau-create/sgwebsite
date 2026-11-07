-- Nouveaux employés : affichage clair par défaut. Les comptes existants gardent leur réglage.
ALTER TABLE "User" ALTER COLUMN "theme" SET DEFAULT 'clair';
