-- Immobilier : bail complet (mentions du formulaire du TAL), réponse à
-- l'avis signée en ligne, signature électronique des documents.
-- Ajouts seulement : compatible avec les installations encore en retard.

-- AlterTable
ALTER TABLE "BailImmo" ADD COLUMN "reponseAvisLe" TIMESTAMP(3),
ADD COLUMN "reponseAvisPar" TEXT,
ADD COLUMN "reponseAvisSignature" TEXT,
ADD COLUMN "reponseAvisIp" TEXT,
ADD COLUMN "accessoires" TEXT,
ADD COLUMN "usageMixte" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "modePaiement" TEXT,
ADD COLUMN "lieuPaiement" TEXT,
ADD COLUMN "chequesPostdates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "premierPaiementLe" TIMESTAMP(3),
ADD COLUMN "chauffage" TEXT,
ADD COLUMN "animaux" TEXT,
ADD COLUMN "fumeur" TEXT,
ADD COLUMN "assuranceResponsabilite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reglementRemisLe" TIMESTAMP(3),
ADD COLUMN "travauxPromis" TEXT,
ADD COLUMN "conditions" TEXT,
ADD COLUMN "immeubleNeuf" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hausseMaximaleF" TEXT,
ADD COLUMN "loyerAncien" DOUBLE PRECISION,
ADD COLUMN "loyerAncienNote" TEXT,
ADD COLUMN "caution" TEXT;

-- AlterTable
ALTER TABLE "DocumentImmo" ADD COLUMN "genre" TEXT,
ADD COLUMN "instantane" JSONB,
ADD COLUMN "donneesSignees" BYTEA,
ADD COLUMN "signeLe" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SignatureImmo" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'LOCATAIRE',
    "locataireId" TEXT,
    "nom" TEXT NOT NULL,
    "courriel" TEXT,
    "jeton" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "empreinte" TEXT NOT NULL,
    "message" TEXT,
    "demandeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoyeLe" TIMESTAMP(3),
    "relances" INTEGER NOT NULL DEFAULT 0,
    "vuLe" TIMESTAMP(3),
    "reponduLe" TIMESTAMP(3),
    "signataireNom" TEXT,
    "signature" TEXT,
    "reponseAvis" TEXT,
    "note" TEXT,
    "ip" TEXT,
    "navigateur" TEXT,
    "creePar" TEXT,

    CONSTRAINT "SignatureImmo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignatureImmo_jeton_key" ON "SignatureImmo"("jeton");

-- CreateIndex
CREATE INDEX "SignatureImmo_documentId_idx" ON "SignatureImmo"("documentId");

-- CreateIndex
CREATE INDEX "SignatureImmo_locataireId_statut_idx" ON "SignatureImmo"("locataireId", "statut");

-- AddForeignKey
ALTER TABLE "SignatureImmo" ADD CONSTRAINT "SignatureImmo_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureImmo" ADD CONSTRAINT "SignatureImmo_locataireId_fkey" FOREIGN KEY ("locataireId") REFERENCES "LocataireImmo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
