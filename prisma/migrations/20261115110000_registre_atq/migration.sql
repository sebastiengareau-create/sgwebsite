-- CreateTable
CREATE TABLE "BoucleBete" (
    "id" TEXT NOT NULL,
    "beteId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "remplaceePar" TEXT NOT NULL,
    "retireeLe" TIMESTAMP(3) NOT NULL,
    "raison" TEXT NOT NULL,
    "note" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoucleBete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeplacementBete" (
    "id" TEXT NOT NULL,
    "beteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "lieu" TEXT,
    "site" TEXT,
    "transporteur" TEXT,
    "note" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeplacementBete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeclarationAtq" (
    "cle" TEXT NOT NULL,
    "declareLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declarePar" TEXT,

    CONSTRAINT "DeclarationAtq_pkey" PRIMARY KEY ("cle")
);

-- CreateIndex
CREATE INDEX "BoucleBete_beteId_idx" ON "BoucleBete"("beteId");

-- CreateIndex
CREATE INDEX "DeplacementBete_beteId_date_idx" ON "DeplacementBete"("beteId", "date");

-- CreateIndex
CREATE INDEX "DeplacementBete_date_idx" ON "DeplacementBete"("date");

-- AddForeignKey
ALTER TABLE "BoucleBete" ADD CONSTRAINT "BoucleBete_beteId_fkey" FOREIGN KEY ("beteId") REFERENCES "Bete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeplacementBete" ADD CONSTRAINT "DeplacementBete_beteId_fkey" FOREIGN KEY ("beteId") REFERENCES "Bete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

