-- CreateTable
CREATE TABLE "Bete" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "identifiant" TEXT,
    "nom" TEXT,
    "sexe" TEXT NOT NULL,
    "genetique" TEXT,
    "pourcentageWagyu" DOUBLE PRECISION,
    "dateNaissance" TIMESTAMP(3),
    "origine" TEXT NOT NULL DEFAULT 'NEE_ICI',
    "dateAcquisition" TIMESTAMP(3),
    "provenance" TEXT,
    "coutAcquisition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mereId" TEXT,
    "pere" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateSortie" TIMESTAMP(3),
    "prixVente" DOUBLE PRECISION,
    "notes" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeseeBete" (
    "id" TEXT NOT NULL,
    "beteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "poids" DOUBLE PRECISION NOT NULL,
    "note" TEXT,

    CONSTRAINT "PeseeBete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraisBete" (
    "id" TEXT NOT NULL,
    "beteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "categorie" TEXT NOT NULL,
    "description" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "FraisBete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Abattage" (
    "id" TEXT NOT NULL,
    "beteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "abattoir" TEXT,
    "poidsVif" DOUBLE PRECISION,
    "poidsCarcasse" DOUBLE PRECISION NOT NULL,
    "bms" INTEGER,
    "fraisAbattage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Abattage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoupeViande" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "rendement" DOUBLE PRECISION NOT NULL,
    "poidsPaquet" DOUBLE PRECISION NOT NULL,
    "prixBoutique" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prixEnLigne" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enLigne" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CoupeViande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotViande" (
    "id" TEXT NOT NULL,
    "abattageId" TEXT NOT NULL,
    "coupeId" TEXT NOT NULL,
    "paquetsEstimes" INTEGER NOT NULL DEFAULT 0,
    "nbPaquets" INTEGER NOT NULL,
    "poidsTotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "LotViande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenteViande" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "canal" TEXT NOT NULL,
    "nbPaquets" INTEGER NOT NULL,
    "poids" DOUBLE PRECISION NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenteViande_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bete_numero_key" ON "Bete"("numero");

-- CreateIndex
CREATE INDEX "PeseeBete_beteId_date_idx" ON "PeseeBete"("beteId", "date");

-- CreateIndex
CREATE INDEX "FraisBete_beteId_idx" ON "FraisBete"("beteId");

-- CreateIndex
CREATE UNIQUE INDEX "Abattage_beteId_key" ON "Abattage"("beteId");

-- CreateIndex
CREATE UNIQUE INDEX "CoupeViande_nom_key" ON "CoupeViande"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "LotViande_abattageId_coupeId_key" ON "LotViande"("abattageId", "coupeId");

-- CreateIndex
CREATE INDEX "VenteViande_lotId_idx" ON "VenteViande"("lotId");

-- CreateIndex
CREATE INDEX "VenteViande_date_idx" ON "VenteViande"("date");

-- AddForeignKey
ALTER TABLE "Bete" ADD CONSTRAINT "Bete_mereId_fkey" FOREIGN KEY ("mereId") REFERENCES "Bete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeseeBete" ADD CONSTRAINT "PeseeBete_beteId_fkey" FOREIGN KEY ("beteId") REFERENCES "Bete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraisBete" ADD CONSTRAINT "FraisBete_beteId_fkey" FOREIGN KEY ("beteId") REFERENCES "Bete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abattage" ADD CONSTRAINT "Abattage_beteId_fkey" FOREIGN KEY ("beteId") REFERENCES "Bete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotViande" ADD CONSTRAINT "LotViande_abattageId_fkey" FOREIGN KEY ("abattageId") REFERENCES "Abattage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotViande" ADD CONSTRAINT "LotViande_coupeId_fkey" FOREIGN KEY ("coupeId") REFERENCES "CoupeViande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenteViande" ADD CONSTRAINT "VenteViande_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "LotViande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

