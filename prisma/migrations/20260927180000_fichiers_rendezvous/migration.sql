-- CreateTable
CREATE TABLE "FichierRendezVous" (
    "id" TEXT NOT NULL,
    "rendezVousId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "donnees" BYTEA NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FichierRendezVous_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FichierRendezVous_rendezVousId_idx" ON "FichierRendezVous"("rendezVousId");

-- AddForeignKey
ALTER TABLE "FichierRendezVous" ADD CONSTRAINT "FichierRendezVous_rendezVousId_fkey" FOREIGN KEY ("rendezVousId") REFERENCES "RendezVous"("id") ON DELETE CASCADE ON UPDATE CASCADE;

