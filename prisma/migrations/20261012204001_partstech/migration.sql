-- AlterTable
ALTER TABLE "Fournisseur" ADD COLUMN     "partstechId" INTEGER;

-- CreateTable
CREATE TABLE "SessionPartsTech" (
    "id" TEXT NOT NULL,
    "jeton" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "sessionId" TEXT,
    "panier" JSONB,
    "recuLe" TIMESTAMP(3),
    "importeLe" TIMESTAMP(3),
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionPartsTech_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionPartsTech_jeton_key" ON "SessionPartsTech"("jeton");

-- CreateIndex
CREATE INDEX "SessionPartsTech_commandeId_idx" ON "SessionPartsTech"("commandeId");

-- CreateIndex
CREATE UNIQUE INDEX "Fournisseur_partstechId_key" ON "Fournisseur"("partstechId");

-- AddForeignKey
ALTER TABLE "SessionPartsTech" ADD CONSTRAINT "SessionPartsTech_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

