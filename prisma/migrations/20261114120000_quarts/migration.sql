-- CreateTable
CREATE TABLE "Quart" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TRAVAIL',
    "debut" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3),
    "ouvertAuto" BOOLEAN NOT NULL DEFAULT false,
    "fermeAuto" BOOLEAN NOT NULL DEFAULT false,
    "debutOriginal" TIMESTAMP(3),
    "finOriginal" TIMESTAMP(3),
    "modifiePar" TEXT,
    "modifieLe" TIMESTAMP(3),
    "ajoutePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionQuart" (
    "id" TEXT NOT NULL,
    "quartId" TEXT,
    "employeId" TEXT,
    "employeNom" TEXT,
    "jour" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ancienne" TEXT,
    "nouvelle" TEXT,
    "raison" TEXT,
    "parId" TEXT,
    "parNom" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionQuart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodeTemps" (
    "id" TEXT NOT NULL,
    "debut" TEXT NOT NULL,
    "fin" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "primes" JSONB,
    "approuvePar" TEXT,
    "approuveLe" TIMESTAMP(3),

    CONSTRAINT "PeriodeTemps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quart_employeId_debut_idx" ON "Quart"("employeId", "debut");

-- CreateIndex
CREATE INDEX "CorrectionQuart_jour_idx" ON "CorrectionQuart"("jour");

-- CreateIndex
CREATE INDEX "CorrectionQuart_employeId_idx" ON "CorrectionQuart"("employeId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodeTemps_debut_fin_key" ON "PeriodeTemps"("debut", "fin");

-- AddForeignKey
ALTER TABLE "Quart" ADD CONSTRAINT "Quart_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
