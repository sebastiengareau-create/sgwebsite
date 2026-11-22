-- AlterTable
ALTER TABLE "BatimentCopro" ADD COLUMN     "entrepreneur" TEXT;

-- AlterTable
ALTER TABLE "CoproprietaireCopro" ADD COLUMN     "besoinsParticuliers" TEXT,
ADD COLUMN     "clesMagnetiques" TEXT,
ADD COLUMN     "contactUrgenceLien" TEXT,
ADD COLUMN     "contactUrgenceNom" TEXT,
ADD COLUMN     "contactUrgenceTel" TEXT,
ADD COLUMN     "mobiliteReduite" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OccupantCopro" ADD COLUMN     "besoinsParticuliers" TEXT,
ADD COLUMN     "clesMagnetiques" TEXT,
ADD COLUMN     "mobiliteReduite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "relation" TEXT;
