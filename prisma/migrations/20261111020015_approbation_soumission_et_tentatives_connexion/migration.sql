-- AlterTable
ALTER TABLE "Soumission" ADD COLUMN     "envoyeeLe" TIMESTAMP(3),
ADD COLUMN     "jetonClient" TEXT,
ADD COLUMN     "noteClient" TEXT,
ADD COLUMN     "reponseClient" TEXT,
ADD COLUMN     "reponseLe" TIMESTAMP(3),
ADD COLUMN     "signataireNom" TEXT,
ADD COLUMN     "signatureClient" TEXT;

-- AlterTable
ALTER TABLE "TacheSoumission" ADD COLUMN     "refusee" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TentativeConnexion" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativeConnexion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TentativeConnexion_cle_creeLe_idx" ON "TentativeConnexion"("cle", "creeLe");

-- CreateIndex
CREATE UNIQUE INDEX "Soumission_jetonClient_key" ON "Soumission"("jetonClient");

