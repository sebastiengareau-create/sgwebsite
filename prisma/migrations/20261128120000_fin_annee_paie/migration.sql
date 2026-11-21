-- AlterTable
ALTER TABLE "User" ADD COLUMN     "codeDentaireT4" INTEGER,
ADD COLUMN     "nomFamille" TEXT,
ADD COLUMN     "prenom" TEXT;

-- CreateTable
CREATE TABLE "ReleveEmploi" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "raison" TEXT NOT NULL,
    "premierJour" TIMESTAMP(3) NOT NULL,
    "dernierJourPaye" TIMESTAMP(3) NOT NULL,
    "finDernierePeriode" TIMESTAMP(3) NOT NULL,
    "typePeriode" TEXT NOT NULL,
    "rappel" TEXT NOT NULL DEFAULT 'U',
    "dateRappel" TIMESTAMP(3),
    "profession" TEXT,
    "heuresAssurables" INTEGER NOT NULL,
    "gainsParPeriode" JSONB NOT NULL,
    "vacances" JSONB,
    "joursFeries" JSONB,
    "autresSommes" JSONB,
    "commentaires" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "numeroSerie" TEXT,
    "transmisLe" TIMESTAMP(3),
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleveEmploi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReleveEmploi_employeId_idx" ON "ReleveEmploi"("employeId");

-- AddForeignKey
ALTER TABLE "ReleveEmploi" ADD CONSTRAINT "ReleveEmploi_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

