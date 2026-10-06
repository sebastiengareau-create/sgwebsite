-- Province (code à deux lettres, ex. « QC ») dans l'adresse des clients et
-- des fournisseurs. Vide par défaut : sans effet pour les fiches existantes.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "province" TEXT;

-- AlterTable
ALTER TABLE "Fournisseur" ADD COLUMN     "province" TEXT;
