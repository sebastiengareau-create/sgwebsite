-- CreateTable
CREATE TABLE "Texto" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MESSAGE',
    "statut" TEXT NOT NULL DEFAULT 'ENVOYE',
    "sid" TEXT,
    "erreur" TEXT,
    "clientId" TEXT,
    "bonId" TEXT,
    "rendezVousId" TEXT,
    "employeId" TEXT,
    "employeNom" TEXT,
    "lu" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Texto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefusTextos" (
    "telephone" TEXT NOT NULL,
    "motCle" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefusTextos_pkey" PRIMARY KEY ("telephone")
);

-- CreateIndex
CREATE UNIQUE INDEX "Texto_sid_key" ON "Texto"("sid");

-- CreateIndex
CREATE INDEX "Texto_telephone_creeLe_idx" ON "Texto"("telephone", "creeLe");

-- CreateIndex
CREATE INDEX "Texto_clientId_idx" ON "Texto"("clientId");

-- CreateIndex
CREATE INDEX "Texto_bonId_idx" ON "Texto"("bonId");

-- CreateIndex
CREATE INDEX "Texto_rendezVousId_idx" ON "Texto"("rendezVousId");

-- CreateIndex
CREATE INDEX "Texto_direction_lu_idx" ON "Texto"("direction", "lu");

