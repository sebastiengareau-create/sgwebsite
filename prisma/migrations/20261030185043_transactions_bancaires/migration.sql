-- AlterTable
ALTER TABLE "LigneEcriture" ADD COLUMN     "transactionBancaireId" TEXT;

-- CreateTable
CREATE TABLE "TransactionBancaire" (
    "id" TEXT NOT NULL,
    "compteTresorerieId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "cle" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'A_EXAMINER',
    "creeType" TEXT,
    "creeId" TEXT,
    "importId" TEXT NOT NULL,
    "fichier" TEXT,
    "importeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "examineLe" TIMESTAMP(3),
    "examinePar" TEXT,

    CONSTRAINT "TransactionBancaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionBancaire_compteTresorerieId_statut_idx" ON "TransactionBancaire"("compteTresorerieId", "statut");

-- CreateIndex
CREATE INDEX "TransactionBancaire_importId_idx" ON "TransactionBancaire"("importId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionBancaire_compteTresorerieId_cle_key" ON "TransactionBancaire"("compteTresorerieId", "cle");

-- CreateIndex
CREATE INDEX "LigneEcriture_transactionBancaireId_idx" ON "LigneEcriture"("transactionBancaireId");

-- AddForeignKey
ALTER TABLE "LigneEcriture" ADD CONSTRAINT "LigneEcriture_transactionBancaireId_fkey" FOREIGN KEY ("transactionBancaireId") REFERENCES "TransactionBancaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionBancaire" ADD CONSTRAINT "TransactionBancaire_compteTresorerieId_fkey" FOREIGN KEY ("compteTresorerieId") REFERENCES "CompteTresorerie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

