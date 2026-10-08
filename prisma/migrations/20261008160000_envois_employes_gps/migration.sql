-- Envoi d'un bon à des employés précis (SMS d'avis, suivi de l'avancement)
-- et positions GPS partagées par leur téléphone. Nouvelles tables seulement :
-- sans effet sur les données existantes.

-- CreateTable
CREATE TABLE "EnvoiBon" (
    "id" TEXT NOT NULL,
    "bonId" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "message" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ENVOYE',
    "smsStatut" TEXT NOT NULL,
    "smsErreur" TEXT,
    "envoyePar" TEXT,
    "envoyeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vuLe" TIMESTAMP(3),
    "termineLe" TIMESTAMP(3),

    CONSTRAINT "EnvoiBon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionGps" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "envoiId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "precision" DOUBLE PRECISION,
    "vitesse" DOUBLE PRECISION,
    "enregistreLe" TIMESTAMP(3) NOT NULL,
    "recuLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionGps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnvoiBon_employeId_statut_idx" ON "EnvoiBon"("employeId", "statut");

-- CreateIndex
CREATE INDEX "EnvoiBon_bonId_idx" ON "EnvoiBon"("bonId");

-- CreateIndex
CREATE INDEX "PositionGps_employeId_enregistreLe_idx" ON "PositionGps"("employeId", "enregistreLe");

-- CreateIndex
CREATE INDEX "PositionGps_envoiId_idx" ON "PositionGps"("envoiId");

-- AddForeignKey
ALTER TABLE "EnvoiBon" ADD CONSTRAINT "EnvoiBon_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonTravail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvoiBon" ADD CONSTRAINT "EnvoiBon_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionGps" ADD CONSTRAINT "PositionGps_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionGps" ADD CONSTRAINT "PositionGps_envoiId_fkey" FOREIGN KEY ("envoiId") REFERENCES "EnvoiBon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

