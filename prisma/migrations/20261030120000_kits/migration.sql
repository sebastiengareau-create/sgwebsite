-- AlterTable
ALTER TABLE "Piece" ADD COLUMN     "estKit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PieceUtilisee" ADD COLUMN     "kit" JSONB;

-- CreateTable
CREATE TABLE "ComposantKit" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "pieceId" TEXT,
    "description" TEXT,
    "qte" DOUBLE PRECISION NOT NULL,
    "coutHoraire" DOUBLE PRECISION,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComposantKit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComposantKit_kitId_idx" ON "ComposantKit"("kitId");

-- CreateIndex
CREATE INDEX "ComposantKit_pieceId_idx" ON "ComposantKit"("pieceId");

-- AddForeignKey
ALTER TABLE "ComposantKit" ADD CONSTRAINT "ComposantKit_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Piece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComposantKit" ADD CONSTRAINT "ComposantKit_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
