-- CreateTable
CREATE TABLE "EnvoiImmo" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "sujet" TEXT NOT NULL,
    "destinataires" TEXT NOT NULL,
    "bailId" TEXT,
    "documentId" TEXT,
    "paiementId" TEXT,
    "erreur" TEXT,
    "envoyePar" TEXT,

    CONSTRAINT "EnvoiImmo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnvoiImmo_bailId_date_idx" ON "EnvoiImmo"("bailId", "date");

-- AddForeignKey
ALTER TABLE "EnvoiImmo" ADD CONSTRAINT "EnvoiImmo_bailId_fkey" FOREIGN KEY ("bailId") REFERENCES "BailImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

