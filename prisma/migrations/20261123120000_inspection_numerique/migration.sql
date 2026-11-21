-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "bonId" TEXT NOT NULL,
    "grille" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "kilometrage" INTEGER,
    "noteGenerale" TEXT,
    "technicienId" TEXT,
    "technicienNom" TEXT,
    "termineeLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jetonClient" TEXT,
    "envoyeeLe" TIMESTAMP(3),
    "reponseClient" TEXT,
    "reponseLe" TIMESTAMP(3),
    "signataireNom" TEXT,
    "signatureClient" TEXT,
    "noteClient" TEXT,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointInspection" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "unite" TEXT,
    "ajoute" BOOLEAN NOT NULL DEFAULT false,
    "etat" TEXT,
    "mesure" TEXT,
    "constat" TEXT,
    "recommandation" TEXT,
    "prixEstime" DOUBLE PRECISION,
    "approbation" TEXT,
    "problemeId" TEXT,

    CONSTRAINT "PointInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoInspection" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "employeId" TEXT,
    "ajouteeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoInspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_jetonClient_key" ON "Inspection"("jetonClient");

-- CreateIndex
CREATE INDEX "Inspection_bonId_idx" ON "Inspection"("bonId");

-- CreateIndex
CREATE INDEX "PointInspection_inspectionId_idx" ON "PointInspection"("inspectionId");

-- CreateIndex
CREATE INDEX "PointInspection_problemeId_idx" ON "PointInspection"("problemeId");

-- CreateIndex
CREATE INDEX "PhotoInspection_pointId_idx" ON "PhotoInspection"("pointId");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonTravail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointInspection" ADD CONSTRAINT "PointInspection_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointInspection" ADD CONSTRAINT "PointInspection_problemeId_fkey" FOREIGN KEY ("problemeId") REFERENCES "Probleme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoInspection" ADD CONSTRAINT "PhotoInspection_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "PointInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

