-- AlterTable
ALTER TABLE "Vehicule" ADD COLUMN "kilometrage" INTEGER;

-- AlterTable
ALTER TABLE "Soumission" ADD COLUMN "vehiculeId" TEXT,
ADD COLUMN "vehiculeDetails" JSONB;

-- AddForeignKey
ALTER TABLE "Soumission" ADD CONSTRAINT "Soumission_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "Vehicule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
