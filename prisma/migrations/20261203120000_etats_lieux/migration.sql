-- CreateTable
CREATE TABLE "EtatLieuxImmo" (
    "id" TEXT NOT NULL,
    "bailId" TEXT NOT NULL,
    "moment" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "pieces" JSONB NOT NULL,
    "compteurs" JSONB,
    "notes" TEXT,
    "documentId" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termineLe" TIMESTAMP(3),

    CONSTRAINT "EtatLieuxImmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoEtatLieuxImmo" (
    "id" TEXT NOT NULL,
    "etatId" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoEtatLieuxImmo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EtatLieuxImmo_bailId_idx" ON "EtatLieuxImmo"("bailId");

-- CreateIndex
CREATE INDEX "PhotoEtatLieuxImmo_etatId_idx" ON "PhotoEtatLieuxImmo"("etatId");

-- AddForeignKey
ALTER TABLE "EtatLieuxImmo" ADD CONSTRAINT "EtatLieuxImmo_bailId_fkey" FOREIGN KEY ("bailId") REFERENCES "BailImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoEtatLieuxImmo" ADD CONSTRAINT "PhotoEtatLieuxImmo_etatId_fkey" FOREIGN KEY ("etatId") REFERENCES "EtatLieuxImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

