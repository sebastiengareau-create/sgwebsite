-- AlterTable
ALTER TABLE "Bete" ADD COLUMN     "pereId" TEXT;

-- CreateTable
CREATE TABLE "Saillie" (
    "id" TEXT NOT NULL,
    "femelleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "taureauId" TEXT,
    "semence" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "veauId" TEXT,
    "note" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Saillie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Saillie_veauId_key" ON "Saillie"("veauId");

-- CreateIndex
CREATE INDEX "Saillie_femelleId_date_idx" ON "Saillie"("femelleId", "date");

-- CreateIndex
CREATE INDEX "Saillie_taureauId_idx" ON "Saillie"("taureauId");

-- CreateIndex
CREATE INDEX "Bete_pereId_idx" ON "Bete"("pereId");

-- AddForeignKey
ALTER TABLE "Bete" ADD CONSTRAINT "Bete_pereId_fkey" FOREIGN KEY ("pereId") REFERENCES "Bete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saillie" ADD CONSTRAINT "Saillie_femelleId_fkey" FOREIGN KEY ("femelleId") REFERENCES "Bete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saillie" ADD CONSTRAINT "Saillie_taureauId_fkey" FOREIGN KEY ("taureauId") REFERENCES "Bete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saillie" ADD CONSTRAINT "Saillie_veauId_fkey" FOREIGN KEY ("veauId") REFERENCES "Bete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

