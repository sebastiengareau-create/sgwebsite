-- CreateIndex
CREATE INDEX "BonTravail_statut_idx" ON "BonTravail"("statut");

-- CreateIndex
CREATE INDEX "BonTravail_clientId_idx" ON "BonTravail"("clientId");

-- CreateIndex
CREATE INDEX "BonTravail_vehiculeId_idx" ON "BonTravail"("vehiculeId");

-- CreateIndex
CREATE INDEX "BonTravail_creeLe_idx" ON "BonTravail"("creeLe");

-- CreateIndex
CREATE INDEX "Depense_statut_idx" ON "Depense"("statut");

-- CreateIndex
CREATE INDEX "Depense_fournisseurId_idx" ON "Depense"("fournisseurId");

-- CreateIndex
CREATE INDEX "EcritureComptable_date_idx" ON "EcritureComptable"("date");

-- CreateIndex
CREATE INDEX "EcritureComptable_sourceId_idx" ON "EcritureComptable"("sourceId");

-- CreateIndex
CREATE INDEX "EntreeTemps_employeId_idx" ON "EntreeTemps"("employeId");

-- CreateIndex
CREATE INDEX "EntreeTemps_problemeId_idx" ON "EntreeTemps"("problemeId");

-- CreateIndex
CREATE INDEX "EntreeTempsInterne_employeId_idx" ON "EntreeTempsInterne"("employeId");

-- CreateIndex
CREATE INDEX "Facture_statut_idx" ON "Facture"("statut");

-- CreateIndex
CREATE INDEX "Facture_dateEmission_idx" ON "Facture"("dateEmission");

-- CreateIndex
CREATE INDEX "HistoriquePiece_pieceId_idx" ON "HistoriquePiece"("pieceId");

-- CreateIndex
CREATE INDEX "LigneCommandeFournisseur_commandeId_idx" ON "LigneCommandeFournisseur"("commandeId");

-- CreateIndex
CREATE INDEX "LigneDepense_depenseId_idx" ON "LigneDepense"("depenseId");

-- CreateIndex
CREATE INDEX "LigneEcriture_ecritureId_idx" ON "LigneEcriture"("ecritureId");

-- CreateIndex
CREATE INDEX "LigneEcriture_compteId_idx" ON "LigneEcriture"("compteId");

-- CreateIndex
CREATE INDEX "MouvementInventaire_pieceId_idx" ON "MouvementInventaire"("pieceId");

-- CreateIndex
CREATE INDEX "Paie_employeId_idx" ON "Paie"("employeId");

-- CreateIndex
CREATE INDEX "Paie_lotId_idx" ON "Paie"("lotId");

-- CreateIndex
CREATE INDEX "Photo_problemeId_idx" ON "Photo"("problemeId");

-- CreateIndex
CREATE INDEX "PieceUtilisee_problemeId_idx" ON "PieceUtilisee"("problemeId");

-- CreateIndex
CREATE INDEX "PieceUtilisee_pieceId_idx" ON "PieceUtilisee"("pieceId");

-- CreateIndex
CREATE INDEX "Probleme_bonId_idx" ON "Probleme"("bonId");

-- CreateIndex
CREATE INDEX "RendezVous_date_idx" ON "RendezVous"("date");

-- CreateIndex
CREATE INDEX "Soumission_statut_idx" ON "Soumission"("statut");

