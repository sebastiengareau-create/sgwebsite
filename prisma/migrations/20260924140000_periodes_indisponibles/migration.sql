-- CreateTable
CREATE TABLE "PeriodeIndisponible" (
    "id" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "motif" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodeIndisponible_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeriodeIndisponible_debut_fin_idx" ON "PeriodeIndisponible"("debut", "fin");

