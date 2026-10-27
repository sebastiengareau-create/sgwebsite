-- CreateTable
CREATE TABLE "EnvoiCourrielDocument" (
    "id" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoyePar" TEXT NOT NULL,
    "modeleNom" TEXT NOT NULL,
    "destinataire" TEXT NOT NULL,
    "groupe" BOOLEAN NOT NULL DEFAULT false,
    "sujet" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "nbEnvoyes" INTEGER NOT NULL,
    "nbEchecs" INTEGER NOT NULL,
    "destinataires" JSONB NOT NULL,

    CONSTRAINT "EnvoiCourrielDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnvoiCourrielDocument_creeLe_idx" ON "EnvoiCourrielDocument"("creeLe");
