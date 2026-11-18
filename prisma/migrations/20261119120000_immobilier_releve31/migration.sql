-- AlterTable
ALTER TABLE "LogementImmo" ADD COLUMN     "adresseCivique" TEXT,
ADD COLUMN     "numeroLogementRq" TEXT;

-- CreateTable
CREATE TABLE "Releve31Immo" (
    "id" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "bailId" TEXT NOT NULL,
    "produitLe" TIMESTAMP(3),
    "remisLe" TIMESTAMP(3),
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Releve31Immo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Releve31Immo_annee_bailId_key" ON "Releve31Immo"("annee", "bailId");

-- AddForeignKey
ALTER TABLE "Releve31Immo" ADD CONSTRAINT "Releve31Immo_bailId_fkey" FOREIGN KEY ("bailId") REFERENCES "BailImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

