-- CreateTable
CREATE TABLE "BatimentCopro" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "anneeConstruction" INTEGER,
    "nbEtages" INTEGER,
    "notes" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatimentCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniteCopro" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "batimentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'LOGEMENT',
    "numeroLot" TEXT,
    "etage" TEXT,
    "superficie" DOUBLE PRECISION,
    "quotePart" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniteCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoproprietaireCopro" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "courriel" TEXT,
    "telephone" TEXT,
    "telephone2" TEXT,
    "adressePostale" TEXT,
    "notes" TEXT,
    "avisCourriel" BOOLEAN NOT NULL DEFAULT true,
    "jetonPortail" TEXT,
    "dernierAccesPortail" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoproprietaireCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProprieteCopro" (
    "id" TEXT NOT NULL,
    "uniteId" TEXT NOT NULL,
    "coproprietaireId" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "partDetenue" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "notes" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProprieteCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupantCopro" (
    "id" TEXT NOT NULL,
    "uniteId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LOCATAIRE',
    "nom" TEXT NOT NULL,
    "courriel" TEXT,
    "telephone" TEXT,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "notes" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OccupantCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EspaceCopro" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "batimentId" TEXT,
    "emplacement" TEXT,
    "uniteId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'USAGE_RESTREINT',
    "fraisMensuel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EspaceCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetCopro" (
    "id" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "moisDebut" INTEGER NOT NULL DEFAULT 1,
    "chargesCourantes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fondsPrevoyance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fondsAutoAssurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adopteLe" TIMESTAMP(3),
    "notes" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeCopro" (
    "id" TEXT NOT NULL,
    "uniteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "periode" TEXT,
    "type" TEXT NOT NULL DEFAULT 'COTISATION',
    "description" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargeCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaiementCopro" (
    "id" TEXT NOT NULL,
    "uniteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "mode" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandeCopro" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'REPARATION',
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT,
    "priorite" TEXT NOT NULL DEFAULT 'NORMALE',
    "statut" TEXT NOT NULL DEFAULT 'NOUVELLE',
    "batimentId" TEXT,
    "uniteId" TEXT,
    "emplacement" TEXT,
    "coproprietaireId" TEXT,
    "signalePar" TEXT,
    "source" TEXT NOT NULL DEFAULT 'INTERNE',
    "reponse" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandeCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravailCopro" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT,
    "priorite" TEXT NOT NULL DEFAULT 'NORMALE',
    "statut" TEXT NOT NULL DEFAULT 'A_PLANIFIER',
    "demandeId" TEXT,
    "entretienId" TEXT,
    "batimentId" TEXT,
    "uniteId" TEXT,
    "emplacement" TEXT,
    "fournisseurId" TEXT,
    "datePrevue" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "coutEstime" DOUBLE PRECISION,
    "coutReel" DOUBLE PRECISION,
    "numeroFacture" TEXT,
    "garantieFin" TIMESTAMP(3),
    "notes" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravailCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiviTravailCopro" (
    "id" TEXT NOT NULL,
    "travailId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT,
    "texte" TEXT,
    "public" BOOLEAN NOT NULL DEFAULT true,
    "auteur" TEXT,

    CONSTRAINT "SuiviTravailCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntretienCopro" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ENTRETIEN',
    "categorie" TEXT,
    "description" TEXT,
    "batimentId" TEXT,
    "emplacement" TEXT,
    "frequenceMois" INTEGER NOT NULL DEFAULT 12,
    "prochaineDate" TIMESTAMP(3) NOT NULL,
    "derniereDate" TIMESTAMP(3),
    "fournisseurId" TEXT,
    "coutEstime" DOUBLE PRECISION,
    "obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntretienCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCopro" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "description" TEXT,
    "visibilite" TEXT NOT NULL DEFAULT 'COPROPRIETAIRES',
    "uniteId" TEXT,
    "batimentId" TEXT,
    "nom" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "donnees" BYTEA NOT NULL,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCopro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FichierCopro" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT,
    "travailId" TEXT,
    "nom" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "donnees" BYTEA NOT NULL,
    "ajoutePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FichierCopro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UniteCopro_numero_key" ON "UniteCopro"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "CoproprietaireCopro_jetonPortail_key" ON "CoproprietaireCopro"("jetonPortail");

-- CreateIndex
CREATE INDEX "ProprieteCopro_uniteId_idx" ON "ProprieteCopro"("uniteId");

-- CreateIndex
CREATE INDEX "ProprieteCopro_coproprietaireId_idx" ON "ProprieteCopro"("coproprietaireId");

-- CreateIndex
CREATE INDEX "OccupantCopro_uniteId_idx" ON "OccupantCopro"("uniteId");

-- CreateIndex
CREATE UNIQUE INDEX "EspaceCopro_type_numero_key" ON "EspaceCopro"("type", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetCopro_annee_key" ON "BudgetCopro"("annee");

-- CreateIndex
CREATE INDEX "ChargeCopro_uniteId_date_idx" ON "ChargeCopro"("uniteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeCopro_uniteId_periode_type_key" ON "ChargeCopro"("uniteId", "periode", "type");

-- CreateIndex
CREATE INDEX "PaiementCopro_uniteId_date_idx" ON "PaiementCopro"("uniteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DemandeCopro_numero_key" ON "DemandeCopro"("numero");

-- CreateIndex
CREATE INDEX "DemandeCopro_statut_idx" ON "DemandeCopro"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "TravailCopro_numero_key" ON "TravailCopro"("numero");

-- CreateIndex
CREATE INDEX "TravailCopro_statut_idx" ON "TravailCopro"("statut");

-- CreateIndex
CREATE INDEX "SuiviTravailCopro_travailId_date_idx" ON "SuiviTravailCopro"("travailId", "date");

-- CreateIndex
CREATE INDEX "EntretienCopro_prochaineDate_idx" ON "EntretienCopro"("prochaineDate");

-- CreateIndex
CREATE INDEX "DocumentCopro_categorie_idx" ON "DocumentCopro"("categorie");

-- CreateIndex
CREATE INDEX "DocumentCopro_uniteId_idx" ON "DocumentCopro"("uniteId");

-- CreateIndex
CREATE INDEX "FichierCopro_demandeId_idx" ON "FichierCopro"("demandeId");

-- CreateIndex
CREATE INDEX "FichierCopro_travailId_idx" ON "FichierCopro"("travailId");

-- AddForeignKey
ALTER TABLE "UniteCopro" ADD CONSTRAINT "UniteCopro_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentCopro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProprieteCopro" ADD CONSTRAINT "ProprieteCopro_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "UniteCopro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProprieteCopro" ADD CONSTRAINT "ProprieteCopro_coproprietaireId_fkey" FOREIGN KEY ("coproprietaireId") REFERENCES "CoproprietaireCopro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupantCopro" ADD CONSTRAINT "OccupantCopro_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "UniteCopro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EspaceCopro" ADD CONSTRAINT "EspaceCopro_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentCopro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EspaceCopro" ADD CONSTRAINT "EspaceCopro_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "UniteCopro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeCopro" ADD CONSTRAINT "ChargeCopro_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "UniteCopro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementCopro" ADD CONSTRAINT "PaiementCopro_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "UniteCopro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeCopro" ADD CONSTRAINT "DemandeCopro_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentCopro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeCopro" ADD CONSTRAINT "DemandeCopro_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "UniteCopro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeCopro" ADD CONSTRAINT "DemandeCopro_coproprietaireId_fkey" FOREIGN KEY ("coproprietaireId") REFERENCES "CoproprietaireCopro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravailCopro" ADD CONSTRAINT "TravailCopro_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "DemandeCopro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravailCopro" ADD CONSTRAINT "TravailCopro_entretienId_fkey" FOREIGN KEY ("entretienId") REFERENCES "EntretienCopro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravailCopro" ADD CONSTRAINT "TravailCopro_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentCopro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravailCopro" ADD CONSTRAINT "TravailCopro_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "UniteCopro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravailCopro" ADD CONSTRAINT "TravailCopro_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviTravailCopro" ADD CONSTRAINT "SuiviTravailCopro_travailId_fkey" FOREIGN KEY ("travailId") REFERENCES "TravailCopro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntretienCopro" ADD CONSTRAINT "EntretienCopro_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentCopro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntretienCopro" ADD CONSTRAINT "EntretienCopro_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCopro" ADD CONSTRAINT "DocumentCopro_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "UniteCopro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCopro" ADD CONSTRAINT "DocumentCopro_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentCopro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichierCopro" ADD CONSTRAINT "FichierCopro_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "DemandeCopro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichierCopro" ADD CONSTRAINT "FichierCopro_travailId_fkey" FOREIGN KEY ("travailId") REFERENCES "TravailCopro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

