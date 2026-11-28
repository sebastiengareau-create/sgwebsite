-- Copropriété reliée à la comptabilité (lib/coproprieteCompta.js) : bon de travail
-- payé par le fonds de prévoyance (faux par défaut)
-- AlterTable
ALTER TABLE "TravailCopro" ADD COLUMN     "fondsPrevoyance" BOOLEAN NOT NULL DEFAULT false;

