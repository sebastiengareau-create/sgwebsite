-- AlterTable
ALTER TABLE "LigneEcriture" ADD COLUMN     "transactionBancaireId" TEXT;

-- CreateTable
CREATE TABLE "ImportBancaire" (
    "id" TEXT NOT NULL,
    "compteTresorerieId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "numeroCompte" TEXT,
    "contenu" BYTEA NOT NULL,
    "nbLues" INTEGER NOT NULL,
    "nbImportees" INTEGER NOT NULL,
    "nbDoublons" INTEGER NOT NULL,
    "debut" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "soldeBanque" DOUBLE PRECISION,
    "soldeLe" TIMESTAMP(3),
    "importePar" TEXT,
    "importeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,

    CONSTRAINT "ImportBancaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionBancaire" (
    "id" TEXT NOT NULL,
    "compteTresorerieId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "cle" TEXT NOT NULL,
    "fitid" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'A_EXAMINER',
    "creeType" TEXT,
    "creeId" TEXT,
    "importId" TEXT NOT NULL,
    "importeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "examineLe" TIMESTAMP(3),
    "examinePar" TEXT,
    "journal" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "TransactionBancaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegleBancaire" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "sens" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "fournisseurId" TEXT,
    "categorieDepenseId" TEXT,
    "taxesIncluses" BOOLEAN NOT NULL DEFAULT false,
    "compteNumero" TEXT,
    "description" TEXT,
    "utilisations" INTEGER NOT NULL DEFAULT 1,
    "derniereUtilisation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegleBancaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBancaire_compteTresorerieId_importeLe_idx" ON "ImportBancaire"("compteTresorerieId", "importeLe");

-- CreateIndex
CREATE INDEX "TransactionBancaire_compteTresorerieId_statut_idx" ON "TransactionBancaire"("compteTresorerieId", "statut");

-- CreateIndex
CREATE INDEX "TransactionBancaire_compteTresorerieId_fitid_idx" ON "TransactionBancaire"("compteTresorerieId", "fitid");

-- CreateIndex
CREATE INDEX "TransactionBancaire_importId_idx" ON "TransactionBancaire"("importId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionBancaire_compteTresorerieId_cle_key" ON "TransactionBancaire"("compteTresorerieId", "cle");

-- CreateIndex
CREATE UNIQUE INDEX "RegleBancaire_signature_sens_key" ON "RegleBancaire"("signature", "sens");

-- CreateIndex
CREATE INDEX "LigneEcriture_transactionBancaireId_idx" ON "LigneEcriture"("transactionBancaireId");

-- AddForeignKey
ALTER TABLE "LigneEcriture" ADD CONSTRAINT "LigneEcriture_transactionBancaireId_fkey" FOREIGN KEY ("transactionBancaireId") REFERENCES "TransactionBancaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBancaire" ADD CONSTRAINT "ImportBancaire_compteTresorerieId_fkey" FOREIGN KEY ("compteTresorerieId") REFERENCES "CompteTresorerie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionBancaire" ADD CONSTRAINT "TransactionBancaire_compteTresorerieId_fkey" FOREIGN KEY ("compteTresorerieId") REFERENCES "CompteTresorerie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionBancaire" ADD CONSTRAINT "TransactionBancaire_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ImportBancaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegleBancaire" ADD CONSTRAINT "RegleBancaire_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegleBancaire" ADD CONSTRAINT "RegleBancaire_categorieDepenseId_fkey" FOREIGN KEY ("categorieDepenseId") REFERENCES "CategorieDepense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

