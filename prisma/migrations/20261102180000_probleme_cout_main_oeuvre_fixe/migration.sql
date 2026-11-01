-- Coût de main-d'œuvre fixé sur une tâche (soumission facturée : heures
-- estimées × coûtant horaire), pour la rentabilité de la facture
ALTER TABLE "Probleme" ADD COLUMN "coutMainOeuvreFixe" DOUBLE PRECISION;
