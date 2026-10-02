-- Une pièce peut avoir un numéro et un prix différents chez chaque
-- fournisseur (PieceFournisseur), et les pièces se commandent par bons de
-- commande fournisseur dont chaque réception devient une dépense à payer.

-- AlterTable
ALTER TABLE "Depense" ADD COLUMN     "commandeFournisseurId" TEXT;

-- CreateTable
CREATE TABLE "PieceFournisseur" (
    "id" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "numeroFournisseur" TEXT,
    "coutant" DOUBLE PRECISION,
    "dernierAchat" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PieceFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandeFournisseur" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "note" TEXT,
    "dateEnvoi" TIMESTAMP(3),
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandeFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneCommandeFournisseur" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "numeroFournisseur" TEXT,
    "qteCommandee" INTEGER NOT NULL,
    "qteRecue" INTEGER NOT NULL DEFAULT 0,
    "coutUnitaire" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "LigneCommandeFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PieceFournisseur_pieceId_fournisseurId_key" ON "PieceFournisseur"("pieceId", "fournisseurId");

-- CreateIndex
CREATE UNIQUE INDEX "PieceFournisseur_fournisseurId_numeroFournisseur_key" ON "PieceFournisseur"("fournisseurId", "numeroFournisseur");

-- CreateIndex
CREATE UNIQUE INDEX "CommandeFournisseur_numero_key" ON "CommandeFournisseur"("numero");

-- AddForeignKey
ALTER TABLE "PieceFournisseur" ADD CONSTRAINT "PieceFournisseur_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceFournisseur" ADD CONSTRAINT "PieceFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeFournisseur" ADD CONSTRAINT "CommandeFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommandeFournisseur" ADD CONSTRAINT "LigneCommandeFournisseur_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommandeFournisseur" ADD CONSTRAINT "LigneCommandeFournisseur_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_commandeFournisseurId_fkey" FOREIGN KEY ("commandeFournisseurId") REFERENCES "CommandeFournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Reprise de l'existant : chaque pièce est liée à son fournisseur habituel,
-- et à chaque fournisseur qui l'a déjà livrée (réception sur une dépense),
-- avec le dernier prix unitaire payé.
INSERT INTO "PieceFournisseur" ("id", "pieceId", "fournisseurId", "coutant", "dernierAchat")
SELECT DISTINCT ON (ld."pieceId", d."fournisseurId")
  'pf' || md5(ld."pieceId" || d."fournisseurId"),
  ld."pieceId", d."fournisseurId", ld."montant" / ld."qteRecue", d."dateFacture"
FROM "LigneDepense" ld
JOIN "Depense" d ON d."id" = ld."depenseId"
WHERE ld."pieceId" IS NOT NULL AND ld."qteRecue" > 0
ORDER BY ld."pieceId", d."fournisseurId", d."dateFacture" DESC;

INSERT INTO "PieceFournisseur" ("id", "pieceId", "fournisseurId")
SELECT 'pf' || md5(p."id" || p."fournisseurId"), p."id", p."fournisseurId"
FROM "Piece" p
WHERE p."fournisseurId" IS NOT NULL
ON CONFLICT ("pieceId", "fournisseurId") DO NOTHING;
