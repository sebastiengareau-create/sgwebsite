-- Index sur les clés étrangères qui n'en avaient pas : PostgreSQL n'indexe pas
-- une clé étrangère de lui-même, donc chaque « pièces de ce fournisseur »,
-- « soumissions de ce client »… parcourait toute la table. Ajouts seulement.
-- CreateIndex
CREATE INDEX "Bete_mereId_idx" ON "Bete"("mereId");

-- CreateIndex
CREATE INDEX "CommandeFournisseur_fournisseurId_idx" ON "CommandeFournisseur"("fournisseurId");

-- CreateIndex
CREATE INDEX "CreditClient_compteTresorerieId_idx" ON "CreditClient"("compteTresorerieId");

-- CreateIndex
CREATE INDEX "DemandeCopro_batimentId_idx" ON "DemandeCopro"("batimentId");

-- CreateIndex
CREATE INDEX "DemandeCopro_uniteId_idx" ON "DemandeCopro"("uniteId");

-- CreateIndex
CREATE INDEX "DemandeCopro_coproprietaireId_idx" ON "DemandeCopro"("coproprietaireId");

-- CreateIndex
CREATE INDEX "Depense_compteTresorerieId_idx" ON "Depense"("compteTresorerieId");

-- CreateIndex
CREATE INDEX "Depense_commandeFournisseurId_idx" ON "Depense"("commandeFournisseurId");

-- CreateIndex
CREATE INDEX "DepotClient_compteTresorerieId_idx" ON "DepotClient"("compteTresorerieId");

-- CreateIndex
CREATE INDEX "DocumentCopro_batimentId_idx" ON "DocumentCopro"("batimentId");

-- CreateIndex
CREATE INDEX "EntreeTempsInterne_tacheInterneId_idx" ON "EntreeTempsInterne"("tacheInterneId");

-- CreateIndex
CREATE INDEX "EntretienCopro_batimentId_idx" ON "EntretienCopro"("batimentId");

-- CreateIndex
CREATE INDEX "EntretienCopro_fournisseurId_idx" ON "EntretienCopro"("fournisseurId");

-- CreateIndex
CREATE INDEX "EspaceCopro_batimentId_idx" ON "EspaceCopro"("batimentId");

-- CreateIndex
CREATE INDEX "EspaceCopro_uniteId_idx" ON "EspaceCopro"("uniteId");

-- CreateIndex
CREATE INDEX "Facture_compteTresorerieId_idx" ON "Facture"("compteTresorerieId");

-- CreateIndex
CREATE INDEX "FactureVente_clientId_idx" ON "FactureVente"("clientId");

-- CreateIndex
CREATE INDEX "FactureVente_compteTresorerieId_idx" ON "FactureVente"("compteTresorerieId");

-- CreateIndex
CREATE INDEX "FermeturePeriodeHistorique_periodeId_idx" ON "FermeturePeriodeHistorique"("periodeId");

-- CreateIndex
CREATE INDEX "LigneCommandeFournisseur_pieceId_idx" ON "LigneCommandeFournisseur"("pieceId");

-- CreateIndex
CREATE INDEX "LigneDepense_categorieDepenseId_idx" ON "LigneDepense"("categorieDepenseId");

-- CreateIndex
CREATE INDEX "LigneDepense_pieceId_idx" ON "LigneDepense"("pieceId");

-- CreateIndex
CREATE INDEX "LotViande_coupeId_idx" ON "LotViande"("coupeId");

-- CreateIndex
CREATE INDEX "PaiementFacture_compteTresorerieId_idx" ON "PaiementFacture"("compteTresorerieId");

-- CreateIndex
CREATE INDEX "Photo_employeId_idx" ON "Photo"("employeId");

-- CreateIndex
CREATE INDEX "Piece_fournisseurId_idx" ON "Piece"("fournisseurId");

-- CreateIndex
CREATE INDEX "PieceACommander_pieceId_idx" ON "PieceACommander"("pieceId");

-- CreateIndex
CREATE INDEX "PieceACommander_commandeId_idx" ON "PieceACommander"("commandeId");

-- CreateIndex
CREATE INDEX "PieceEstimee_tacheSoumissionId_idx" ON "PieceEstimee"("tacheSoumissionId");

-- CreateIndex
CREATE INDEX "Probleme_retourPieceId_idx" ON "Probleme"("retourPieceId");

-- CreateIndex
CREATE INDEX "RapprochementBancaire_compteTresorerieId_idx" ON "RapprochementBancaire"("compteTresorerieId");

-- CreateIndex
CREATE INDEX "RegleBancaire_fournisseurId_idx" ON "RegleBancaire"("fournisseurId");

-- CreateIndex
CREATE INDEX "RegleBancaire_categorieDepenseId_idx" ON "RegleBancaire"("categorieDepenseId");

-- CreateIndex
CREATE INDEX "RendezVous_clientId_idx" ON "RendezVous"("clientId");

-- CreateIndex
CREATE INDEX "Soumission_clientId_idx" ON "Soumission"("clientId");

-- CreateIndex
CREATE INDEX "Soumission_vehiculeId_idx" ON "Soumission"("vehiculeId");

-- CreateIndex
CREATE INDEX "TacheSoumission_soumissionId_idx" ON "TacheSoumission"("soumissionId");

-- CreateIndex
CREATE INDEX "TravailCopro_demandeId_idx" ON "TravailCopro"("demandeId");

-- CreateIndex
CREATE INDEX "TravailCopro_entretienId_idx" ON "TravailCopro"("entretienId");

-- CreateIndex
CREATE INDEX "TravailCopro_batimentId_idx" ON "TravailCopro"("batimentId");

-- CreateIndex
CREATE INDEX "TravailCopro_uniteId_idx" ON "TravailCopro"("uniteId");

-- CreateIndex
CREATE INDEX "TravailCopro_fournisseurId_idx" ON "TravailCopro"("fournisseurId");

-- CreateIndex
CREATE INDEX "UniteCopro_batimentId_idx" ON "UniteCopro"("batimentId");

