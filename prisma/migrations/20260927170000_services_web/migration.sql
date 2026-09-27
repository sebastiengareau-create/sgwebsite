-- CreateTable
CREATE TABLE "ServiceWeb" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "dureeMinutes" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceWeb_pkey" PRIMARY KEY ("id")
);

