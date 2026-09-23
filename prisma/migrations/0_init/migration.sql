-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "courriel" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pin" TEXT,
    "qbId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "telephone" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "codePostal" TEXT,
    "assignation" TEXT,
    "numeroEmploye" TEXT,
    "dateEmbauche" TIMESTAMP(3),
    "theme" TEXT NOT NULL DEFAULT 'sombre',
    "tailleTexte" TEXT NOT NULL DEFAULT 'normal',
    "estSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "accesSections" TEXT,
    "typeRemuneration" TEXT NOT NULL DEFAULT 'HORAIRE',
    "tauxHoraireEmploye" DOUBLE PRECISION,
    "salaireAnnuel" DOUBLE PRECISION,
    "frequencePaie" TEXT NOT NULL DEFAULT 'BIHEBDOMADAIRE',
    "tauxVacances" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "courriel" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "codePostal" TEXT,
    "garantieProlongee" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonTravail" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "clientId" TEXT NOT NULL,
    "escompteMontant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "escompteRaison" TEXT,
    "tauxHoraireOverride" DOUBLE PRECISION,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonTravail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facture" (
    "id" TEXT NOT NULL,
    "bonId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'IMPAYEE',
    "totalPieces" DOUBLE PRECISION NOT NULL,
    "totalMainOeuvre" DOUBLE PRECISION NOT NULL,
    "totalAutresRevenus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "escompteApplique" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFacture" DOUBLE PRECISION NOT NULL,
    "tauxHoraireUtilise" DOUBLE PRECISION NOT NULL,
    "heuresFacturees" DOUBLE PRECISION NOT NULL,
    "tpsMontant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tvqMontant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAvecTaxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datePaiement" TIMESTAMP(3),
    "modePaiement" TEXT,
    "compteTresorerieId" TEXT,
    "referenceVersement" TEXT,

    CONSTRAINT "Facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Probleme" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categorieRevenu" TEXT NOT NULL DEFAULT 'MAIN_OEUVRE',
    "factureDescription" TEXT,
    "facturePrixUnitaire" DOUBLE PRECISION,
    "factureQte" DOUBLE PRECISION DEFAULT 1,
    "bonId" TEXT NOT NULL,

    CONSTRAINT "Probleme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "problemeId" TEXT NOT NULL,
    "employeId" TEXT,
    "ajouteeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Piece" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "qte" INTEGER NOT NULL DEFAULT 0,
    "qteMin" INTEGER NOT NULL DEFAULT 0,
    "qteMax" INTEGER,
    "emplacement" TEXT,
    "prix" DOUBLE PRECISION NOT NULL,
    "coutant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "categorie" TEXT NOT NULL DEFAULT 'PIECE',
    "fournisseurId" TEXT,
    "qbId" TEXT,
    "syncLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Piece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PieceUtilisee" (
    "id" TEXT NOT NULL,
    "problemeId" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "qte" INTEGER NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PieceUtilisee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementInventaire" (
    "id" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "qte" INTEGER NOT NULL,
    "solde" INTEGER NOT NULL,
    "note" TEXT,
    "pieceUtiliseeId" TEXT,
    "ligneDepenseId" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementInventaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriquePiece" (
    "id" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "champ" TEXT NOT NULL,
    "ancienneValeur" TEXT,
    "nouvelleValeur" TEXT,
    "modifiePar" TEXT,
    "modifieLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoriquePiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Soumission" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clientId" TEXT,
    "clientNom" TEXT NOT NULL,
    "clientTelephone" TEXT,
    "vehiculeInfo" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "bonId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Soumission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacheSoumission" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tempsEstime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soumissionId" TEXT NOT NULL,

    CONSTRAINT "TacheSoumission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PieceEstimee" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prixEstime" DOUBLE PRECISION NOT NULL,
    "qte" INTEGER NOT NULL DEFAULT 1,
    "tacheSoumissionId" TEXT NOT NULL,

    CONSTRAINT "PieceEstimee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RendezVous" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "clientNom" TEXT NOT NULL,
    "clientTelephone" TEXT,
    "vehiculeInfo" TEXT,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "dureeMinutes" INTEGER NOT NULL DEFAULT 60,
    "motif" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'CONFIRME',
    "bonId" TEXT,
    "referenceExterne" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RendezVous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compte" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "typeCharge" TEXT,

    CONSTRAINT "Compte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompteTresorerie" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "soldeReleve" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soldeReleveLe" TIMESTAMP(3),
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompteTresorerie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcritureComptable" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "sourceId" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcritureComptable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneEcriture" (
    "id" TEXT NOT NULL,
    "ecritureId" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "rapproche" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LigneEcriture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacheInterne" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TacheInterne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntreeTempsInterne" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "tacheInterneId" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3),

    CONSTRAINT "EntreeTempsInterne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotPaie" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "periodeDebut" TIMESTAMP(3) NOT NULL,
    "periodeFin" TIMESTAMP(3) NOT NULL,
    "dateVersementPrevue" TIMESTAMP(3),
    "typePaie" TEXT NOT NULL DEFAULT 'REGULIERE',
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "creePar" TEXT,
    "comptabiliseLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotPaie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paie" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "lotId" TEXT,
    "periodeDebut" TIMESTAMP(3) NOT NULL,
    "periodeFin" TIMESTAMP(3) NOT NULL,
    "heuresTravaillees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heuresHorodateur" DOUBLE PRECISION,
    "boni" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salaireBrut" DOUBLE PRECISION NOT NULL,
    "rrqEmploye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rqapEmploye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aeEmploye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impotFederal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impotQuebec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salaireNet" DOUBLE PRECISION NOT NULL,
    "rrqEmployeur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rqapEmployeur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aeEmployeur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vacancesAccumulees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "typePaie" TEXT NOT NULL DEFAULT 'REGULIERE',
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "corrigeeParId" TEXT,
    "dateVersement" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategorieInventaire" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "compteRevenuNumero" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CategorieInventaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapprochementBancaire" (
    "id" TEXT NOT NULL,
    "compteTresorerieId" TEXT,
    "dateRapprochement" TIMESTAMP(3) NOT NULL,
    "soldeReleve" DOUBLE PRECISION NOT NULL,
    "soldeLivres" DOUBLE PRECISION NOT NULL,
    "ecart" DOUBLE PRECISION NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RapprochementBancaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fournisseur" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "courriel" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "codePostal" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategorieDepense" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "compteDepenseNumero" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CategorieDepense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Depense" (
    "id" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "tpsPayee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tvqPayee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dateFacture" TIMESTAMP(3) NOT NULL,
    "dateEcheance" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'IMPAYEE',
    "datePaiement" TIMESTAMP(3),
    "referenceVersement" TEXT,
    "modePaiement" TEXT,
    "compteTresorerieId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Depense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneDepense" (
    "id" TEXT NOT NULL,
    "depenseId" TEXT NOT NULL,
    "categorieDepenseId" TEXT NOT NULL,
    "description" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "pieceId" TEXT,
    "qteRecue" INTEGER,

    CONSTRAINT "LigneDepense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Immobilisation" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "dateAcquisition" TIMESTAMP(3) NOT NULL,
    "coutAcquisition" DOUBLE PRECISION NOT NULL,
    "valeurResiduelle" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dureeVieAns" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Immobilisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmortissementMensuel" (
    "id" TEXT NOT NULL,
    "mois" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmortissementMensuel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametre" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,

    CONSTRAINT "Parametre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodeComptable" (
    "id" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "statutParNom" TEXT,
    "statutLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodeComptable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FermeturePeriodeHistorique" (
    "id" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "statutAvant" TEXT NOT NULL,
    "statutApres" TEXT NOT NULL,
    "parNom" TEXT NOT NULL,
    "motif" TEXT,
    "resumeJson" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FermeturePeriodeHistorique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntreeTemps" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "problemeId" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3),

    CONSTRAINT "EntreeTemps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_courriel_key" ON "User"("courriel");

-- CreateIndex
CREATE UNIQUE INDEX "User_pin_key" ON "User"("pin");

-- CreateIndex
CREATE UNIQUE INDEX "User_numeroEmploye_key" ON "User"("numeroEmploye");

-- CreateIndex
CREATE UNIQUE INDEX "Client_numero_key" ON "Client"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "BonTravail_numero_key" ON "BonTravail"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Facture_bonId_key" ON "Facture"("bonId");

-- CreateIndex
CREATE UNIQUE INDEX "Facture_numero_key" ON "Facture"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Piece_numero_key" ON "Piece"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Soumission_numero_key" ON "Soumission"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Soumission_bonId_key" ON "Soumission"("bonId");

-- CreateIndex
CREATE UNIQUE INDEX "RendezVous_bonId_key" ON "RendezVous"("bonId");

-- CreateIndex
CREATE UNIQUE INDEX "RendezVous_referenceExterne_key" ON "RendezVous"("referenceExterne");

-- CreateIndex
CREATE UNIQUE INDEX "Compte_numero_key" ON "Compte"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "CompteTresorerie_compteId_key" ON "CompteTresorerie"("compteId");

-- CreateIndex
CREATE UNIQUE INDEX "EcritureComptable_numero_key" ON "EcritureComptable"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "LotPaie_numero_key" ON "LotPaie"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "CategorieInventaire_code_key" ON "CategorieInventaire"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Fournisseur_numero_key" ON "Fournisseur"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "CategorieDepense_code_key" ON "CategorieDepense"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AmortissementMensuel_mois_key" ON "AmortissementMensuel"("mois");

-- CreateIndex
CREATE UNIQUE INDEX "Parametre_cle_key" ON "Parametre"("cle");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodeComptable_annee_mois_key" ON "PeriodeComptable"("annee", "mois");

-- AddForeignKey
ALTER TABLE "BonTravail" ADD CONSTRAINT "BonTravail_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonTravail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_compteTresorerieId_fkey" FOREIGN KEY ("compteTresorerieId") REFERENCES "CompteTresorerie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Probleme" ADD CONSTRAINT "Probleme_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonTravail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_problemeId_fkey" FOREIGN KEY ("problemeId") REFERENCES "Probleme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceUtilisee" ADD CONSTRAINT "PieceUtilisee_problemeId_fkey" FOREIGN KEY ("problemeId") REFERENCES "Probleme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceUtilisee" ADD CONSTRAINT "PieceUtilisee_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementInventaire" ADD CONSTRAINT "MouvementInventaire_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriquePiece" ADD CONSTRAINT "HistoriquePiece_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Soumission" ADD CONSTRAINT "Soumission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacheSoumission" ADD CONSTRAINT "TacheSoumission_soumissionId_fkey" FOREIGN KEY ("soumissionId") REFERENCES "Soumission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceEstimee" ADD CONSTRAINT "PieceEstimee_tacheSoumissionId_fkey" FOREIGN KEY ("tacheSoumissionId") REFERENCES "TacheSoumission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonTravail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteTresorerie" ADD CONSTRAINT "CompteTresorerie_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "Compte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneEcriture" ADD CONSTRAINT "LigneEcriture_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "EcritureComptable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneEcriture" ADD CONSTRAINT "LigneEcriture_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "Compte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntreeTempsInterne" ADD CONSTRAINT "EntreeTempsInterne_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntreeTempsInterne" ADD CONSTRAINT "EntreeTempsInterne_tacheInterneId_fkey" FOREIGN KEY ("tacheInterneId") REFERENCES "TacheInterne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paie" ADD CONSTRAINT "Paie_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paie" ADD CONSTRAINT "Paie_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "LotPaie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapprochementBancaire" ADD CONSTRAINT "RapprochementBancaire_compteTresorerieId_fkey" FOREIGN KEY ("compteTresorerieId") REFERENCES "CompteTresorerie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_compteTresorerieId_fkey" FOREIGN KEY ("compteTresorerieId") REFERENCES "CompteTresorerie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDepense" ADD CONSTRAINT "LigneDepense_depenseId_fkey" FOREIGN KEY ("depenseId") REFERENCES "Depense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDepense" ADD CONSTRAINT "LigneDepense_categorieDepenseId_fkey" FOREIGN KEY ("categorieDepenseId") REFERENCES "CategorieDepense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDepense" ADD CONSTRAINT "LigneDepense_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FermeturePeriodeHistorique" ADD CONSTRAINT "FermeturePeriodeHistorique_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "PeriodeComptable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntreeTemps" ADD CONSTRAINT "EntreeTemps_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntreeTemps" ADD CONSTRAINT "EntreeTemps_problemeId_fkey" FOREIGN KEY ("problemeId") REFERENCES "Probleme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

