-- CreateTable
CREATE TABLE "JeuPneus" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehiculeId" TEXT,
    "saison" TEXT NOT NULL,
    "marque" TEXT,
    "modele" TEXT,
    "dimension" TEXT,
    "quantite" INTEGER NOT NULL DEFAULT 4,
    "jantes" TEXT NOT NULL DEFAULT 'SANS',
    "anneeFabrication" INTEGER,
    "usure" TEXT,
    "emplacement" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ENTREPOSE',
    "note" TEXT,
    "rappelLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JeuPneus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementPneus" (
    "id" TEXT NOT NULL,
    "jeuId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "emplacement" TEXT,
    "usure" TEXT,
    "bonId" TEXT,
    "employeNom" TEXT,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementPneus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JeuPneus_numero_key" ON "JeuPneus"("numero");

-- CreateIndex
CREATE INDEX "JeuPneus_clientId_idx" ON "JeuPneus"("clientId");

-- CreateIndex
CREATE INDEX "JeuPneus_vehiculeId_idx" ON "JeuPneus"("vehiculeId");

-- CreateIndex
CREATE INDEX "JeuPneus_statut_idx" ON "JeuPneus"("statut");

-- CreateIndex
CREATE INDEX "MouvementPneus_jeuId_idx" ON "MouvementPneus"("jeuId");

-- CreateIndex
CREATE INDEX "MouvementPneus_bonId_idx" ON "MouvementPneus"("bonId");

-- AddForeignKey
ALTER TABLE "JeuPneus" ADD CONSTRAINT "JeuPneus_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JeuPneus" ADD CONSTRAINT "JeuPneus_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "Vehicule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementPneus" ADD CONSTRAINT "MouvementPneus_jeuId_fkey" FOREIGN KEY ("jeuId") REFERENCES "JeuPneus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementPneus" ADD CONSTRAINT "MouvementPneus_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonTravail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

