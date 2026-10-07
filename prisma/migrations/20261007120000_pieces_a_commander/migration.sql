-- Pièces à commander d'un bon : résultats collés depuis le site d'un
-- fournisseur (« 🔎 Rechercher des pièces »). Nouvelle table, sans effet
-- sur les données existantes.

-- CreateTable
CREATE TABLE "PieceACommander" (
    "id" TEXT NOT NULL,
    "bonId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "numero" TEXT,
    "fournisseur" TEXT,
    "prix" DOUBLE PRECISION,
    "qte" INTEGER NOT NULL DEFAULT 1,
    "lien" TEXT,
    "commandee" BOOLEAN NOT NULL DEFAULT false,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PieceACommander_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PieceACommander_bonId_idx" ON "PieceACommander"("bonId");

-- AddForeignKey
ALTER TABLE "PieceACommander" ADD CONSTRAINT "PieceACommander_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonTravail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

