-- AlterTable
ALTER TABLE "Facture" ADD COLUMN     "montantPaye" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PaiementFacture" (
    "id" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "modePaiement" TEXT,
    "compteTresorerieId" TEXT NOT NULL,
    "reference" TEXT,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ecritureId" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementFacture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaiementFacture_factureId_idx" ON "PaiementFacture"("factureId");

-- AddForeignKey
ALTER TABLE "PaiementFacture" ADD CONSTRAINT "PaiementFacture_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementFacture" ADD CONSTRAINT "PaiementFacture_compteTresorerieId_fkey" FOREIGN KEY ("compteTresorerieId") REFERENCES "CompteTresorerie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Reprise des factures déjà payées : un paiement unique du total (même id
-- que la facture, pour que l'annulation d'un examen bancaire déjà fait —
-- qui pointe la facture — retrouve son paiement). Les factures payées par
-- le coûtant d'un véhicule à vendre n'ont pas de compte : solde à 0 seulement.
UPDATE "Facture" SET "montantPaye" = "totalAvecTaxes" WHERE "statut" = 'PAYEE';

INSERT INTO "PaiementFacture" ("id", "factureId", "montant", "modePaiement", "compteTresorerieId", "reference", "datePaiement", "ecritureId")
SELECT f."id", f."id", f."totalAvecTaxes", f."modePaiement", f."compteTresorerieId", f."referenceVersement",
       COALESCE(f."datePaiement", f."dateEmission"),
       (SELECT e."id" FROM "EcritureComptable" e WHERE e."source" = 'FACTURE_PAYEE' AND e."sourceId" = f."id" ORDER BY e."creeLe" DESC LIMIT 1)
FROM "Facture" f
WHERE f."statut" = 'PAYEE' AND f."compteTresorerieId" IS NOT NULL;
