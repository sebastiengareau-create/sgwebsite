-- CreateTable
CREATE TABLE "SoinBete" (
    "id" TEXT NOT NULL,
    "beteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "produit" TEXT,
    "dose" TEXT,
    "retraitJours" INTEGER,
    "rappelLe" TIMESTAMP(3),
    "note" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoinBete_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoinBete_beteId_date_idx" ON "SoinBete"("beteId", "date");

-- AddForeignKey
ALTER TABLE "SoinBete" ADD CONSTRAINT "SoinBete_beteId_fkey" FOREIGN KEY ("beteId") REFERENCES "Bete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
