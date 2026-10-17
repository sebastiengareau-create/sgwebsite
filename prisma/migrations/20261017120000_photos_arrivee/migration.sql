-- CreateTable
CREATE TABLE "PhotoArrivee" (
    "id" TEXT NOT NULL,
    "bonId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "employeId" TEXT,
    "ajouteeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoArrivee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoArrivee_bonId_position_key" ON "PhotoArrivee"("bonId", "position");

-- AddForeignKey
ALTER TABLE "PhotoArrivee" ADD CONSTRAINT "PhotoArrivee_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonTravail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
