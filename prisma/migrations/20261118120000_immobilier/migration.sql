-- CreateTable
CREATE TABLE "ImmeubleImmo" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "ville" TEXT,
    "codePostal" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PLEX',
    "anneeConstruction" INTEGER,
    "dateAchat" TIMESTAMP(3),
    "prixAchat" DOUBLE PRECISION,
    "evaluationMunicipale" DOUBLE PRECISION,
    "valeurEstimee" DOUBLE PRECISION,
    "soldeHypotheque" DOUBLE PRECISION,
    "notes" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImmeubleImmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogementImmo" (
    "id" TEXT NOT NULL,
    "immeubleId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LOGEMENT',
    "pieces" TEXT,
    "etage" TEXT,
    "superficie" DOUBLE PRECISION,
    "loyerVise" DOUBLE PRECISION,
    "notes" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogementImmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocataireImmo" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "courriel" TEXT,
    "telephone" TEXT,
    "telephone2" TEXT,
    "contactUrgence" TEXT,
    "notes" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocataireImmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BailImmo" (
    "id" TEXT NOT NULL,
    "logementId" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "loyer" DOUBLE PRECISION NOT NULL,
    "jourPaiement" INTEGER NOT NULL DEFAULT 1,
    "services" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "nouveauLoyer" DOUBLE PRECISION,
    "avisEnvoyeLe" TIMESTAMP(3),
    "reponseAvis" TEXT,
    "terminaisonLe" TIMESTAMP(3),
    "notes" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BailImmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeImmo" (
    "id" TEXT NOT NULL,
    "bailId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "periode" TEXT,
    "type" TEXT NOT NULL DEFAULT 'LOYER',
    "description" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargeImmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaiementImmo" (
    "id" TEXT NOT NULL,
    "bailId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "mode" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementImmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepenseImmo" (
    "id" TEXT NOT NULL,
    "immeubleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "categorie" TEXT NOT NULL,
    "description" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "payeA" TEXT,
    "reference" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepenseImmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReparationImmo" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT,
    "priorite" TEXT NOT NULL DEFAULT 'NORMALE',
    "statut" TEXT NOT NULL DEFAULT 'NOUVELLE',
    "immeubleId" TEXT NOT NULL,
    "logementId" TEXT,
    "locataireId" TEXT,
    "signalePar" TEXT,
    "entrepreneur" TEXT,
    "telephoneEntrepreneur" TEXT,
    "datePrevue" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "coutEstime" DOUBLE PRECISION,
    "coutReel" DOUBLE PRECISION,
    "numeroFacture" TEXT,
    "notes" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReparationImmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentImmo" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "expireLe" TIMESTAMP(3),
    "description" TEXT,
    "immeubleId" TEXT,
    "logementId" TEXT,
    "bailId" TEXT,
    "locataireId" TEXT,
    "nom" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "donnees" BYTEA NOT NULL,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentImmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FichierImmo" (
    "id" TEXT NOT NULL,
    "reparationId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "donnees" BYTEA NOT NULL,
    "ajoutePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FichierImmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BailImmoToLocataireImmo" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "LogementImmo_immeubleId_numero_key" ON "LogementImmo"("immeubleId", "numero");

-- CreateIndex
CREATE INDEX "BailImmo_logementId_idx" ON "BailImmo"("logementId");

-- CreateIndex
CREATE INDEX "BailImmo_statut_idx" ON "BailImmo"("statut");

-- CreateIndex
CREATE INDEX "ChargeImmo_bailId_date_idx" ON "ChargeImmo"("bailId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeImmo_bailId_periode_type_key" ON "ChargeImmo"("bailId", "periode", "type");

-- CreateIndex
CREATE INDEX "PaiementImmo_bailId_date_idx" ON "PaiementImmo"("bailId", "date");

-- CreateIndex
CREATE INDEX "DepenseImmo_immeubleId_date_idx" ON "DepenseImmo"("immeubleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReparationImmo_numero_key" ON "ReparationImmo"("numero");

-- CreateIndex
CREATE INDEX "ReparationImmo_statut_idx" ON "ReparationImmo"("statut");

-- CreateIndex
CREATE INDEX "ReparationImmo_immeubleId_idx" ON "ReparationImmo"("immeubleId");

-- CreateIndex
CREATE INDEX "ReparationImmo_logementId_idx" ON "ReparationImmo"("logementId");

-- CreateIndex
CREATE INDEX "ReparationImmo_locataireId_idx" ON "ReparationImmo"("locataireId");

-- CreateIndex
CREATE INDEX "DocumentImmo_categorie_idx" ON "DocumentImmo"("categorie");

-- CreateIndex
CREATE INDEX "DocumentImmo_immeubleId_idx" ON "DocumentImmo"("immeubleId");

-- CreateIndex
CREATE INDEX "DocumentImmo_logementId_idx" ON "DocumentImmo"("logementId");

-- CreateIndex
CREATE INDEX "DocumentImmo_bailId_idx" ON "DocumentImmo"("bailId");

-- CreateIndex
CREATE INDEX "DocumentImmo_locataireId_idx" ON "DocumentImmo"("locataireId");

-- CreateIndex
CREATE INDEX "FichierImmo_reparationId_idx" ON "FichierImmo"("reparationId");

-- CreateIndex
CREATE UNIQUE INDEX "_BailImmoToLocataireImmo_AB_unique" ON "_BailImmoToLocataireImmo"("A", "B");

-- CreateIndex
CREATE INDEX "_BailImmoToLocataireImmo_B_index" ON "_BailImmoToLocataireImmo"("B");

-- AddForeignKey
ALTER TABLE "LogementImmo" ADD CONSTRAINT "LogementImmo_immeubleId_fkey" FOREIGN KEY ("immeubleId") REFERENCES "ImmeubleImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BailImmo" ADD CONSTRAINT "BailImmo_logementId_fkey" FOREIGN KEY ("logementId") REFERENCES "LogementImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeImmo" ADD CONSTRAINT "ChargeImmo_bailId_fkey" FOREIGN KEY ("bailId") REFERENCES "BailImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementImmo" ADD CONSTRAINT "PaiementImmo_bailId_fkey" FOREIGN KEY ("bailId") REFERENCES "BailImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepenseImmo" ADD CONSTRAINT "DepenseImmo_immeubleId_fkey" FOREIGN KEY ("immeubleId") REFERENCES "ImmeubleImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReparationImmo" ADD CONSTRAINT "ReparationImmo_immeubleId_fkey" FOREIGN KEY ("immeubleId") REFERENCES "ImmeubleImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReparationImmo" ADD CONSTRAINT "ReparationImmo_logementId_fkey" FOREIGN KEY ("logementId") REFERENCES "LogementImmo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReparationImmo" ADD CONSTRAINT "ReparationImmo_locataireId_fkey" FOREIGN KEY ("locataireId") REFERENCES "LocataireImmo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentImmo" ADD CONSTRAINT "DocumentImmo_immeubleId_fkey" FOREIGN KEY ("immeubleId") REFERENCES "ImmeubleImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentImmo" ADD CONSTRAINT "DocumentImmo_logementId_fkey" FOREIGN KEY ("logementId") REFERENCES "LogementImmo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentImmo" ADD CONSTRAINT "DocumentImmo_bailId_fkey" FOREIGN KEY ("bailId") REFERENCES "BailImmo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentImmo" ADD CONSTRAINT "DocumentImmo_locataireId_fkey" FOREIGN KEY ("locataireId") REFERENCES "LocataireImmo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichierImmo" ADD CONSTRAINT "FichierImmo_reparationId_fkey" FOREIGN KEY ("reparationId") REFERENCES "ReparationImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BailImmoToLocataireImmo" ADD CONSTRAINT "_BailImmoToLocataireImmo_A_fkey" FOREIGN KEY ("A") REFERENCES "BailImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BailImmoToLocataireImmo" ADD CONSTRAINT "_BailImmoToLocataireImmo_B_fkey" FOREIGN KEY ("B") REFERENCES "LocataireImmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

