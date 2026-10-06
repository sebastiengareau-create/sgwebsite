-- Province (code à deux lettres, ex. « QC ») dans l'adresse des employés.
-- Vide par défaut : sans effet pour les fiches existantes.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "province" TEXT;
