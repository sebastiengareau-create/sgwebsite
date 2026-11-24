-- AlterTable
ALTER TABLE "JeuPneus" ADD COLUMN     "antivol" TEXT,
ADD COLUMN     "capteurs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "couple" INTEGER,
ADD COLUMN     "enjoliveurs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pneus" JSONB,
ADD COLUMN     "pression" INTEGER;

-- CreateTable
CREATE TABLE "PhotoPneus" (
    "id" TEXT NOT NULL,
    "jeuId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "employeNom" TEXT,
    "ajouteeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoPneus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoPneus_jeuId_idx" ON "PhotoPneus"("jeuId");

-- AddForeignKey
ALTER TABLE "PhotoPneus" ADD CONSTRAINT "PhotoPneus_jeuId_fkey" FOREIGN KEY ("jeuId") REFERENCES "JeuPneus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

