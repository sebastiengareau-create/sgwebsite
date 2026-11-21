-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "jetonPortail" TEXT,
ADD COLUMN     "portailCreeLe" TIMESTAMP(3),
ADD COLUMN     "portailVuLe" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Client_jetonPortail_key" ON "Client"("jetonPortail");

