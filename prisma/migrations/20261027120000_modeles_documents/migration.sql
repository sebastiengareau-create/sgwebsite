-- CreateTable
CREATE TABLE "ModeleDocument" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "destinataire" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeleDocument_pkey" PRIMARY KEY ("id")
);
