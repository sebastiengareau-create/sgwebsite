-- Pièce hors inventaire : coûtant unitaire figé sur la ligne
ALTER TABLE "Probleme" ADD COLUMN "factureCoutant" DOUBLE PRECISION;
