-- CreateTable
CREATE TABLE "PhotoPiece" (
    "id" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "employeId" TEXT,
    "ajouteeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoPiece_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoPiece_pieceId_key" ON "PhotoPiece"("pieceId");

-- AddForeignKey
ALTER TABLE "PhotoPiece" ADD CONSTRAINT "PhotoPiece_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE CASCADE ON UPDATE CASCADE;
