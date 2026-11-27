-- Photo d'un immeuble (Immobilier) ou d'un bâtiment (Copropriété)
CREATE TABLE "PhotoBatiment" (
    "id" TEXT NOT NULL,
    "immeubleId" TEXT,
    "batimentId" TEXT,
    "url" TEXT NOT NULL,
    "ajoutePar" TEXT,
    "ajouteeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoBatiment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoBatiment_immeubleId_key" ON "PhotoBatiment"("immeubleId");
CREATE UNIQUE INDEX "PhotoBatiment_batimentId_key" ON "PhotoBatiment"("batimentId");

ALTER TABLE "PhotoBatiment" ADD CONSTRAINT "PhotoBatiment_immeubleId_fkey" FOREIGN KEY ("immeubleId") REFERENCES "ImmeubleImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoBatiment" ADD CONSTRAINT "PhotoBatiment_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentCopro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
