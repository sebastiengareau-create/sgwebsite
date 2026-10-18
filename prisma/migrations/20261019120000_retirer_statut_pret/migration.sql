-- Le statut « Prêt » est retiré : les bons qui l'avaient reviennent « En cours »
-- (l'avis au client se fait maintenant depuis un bon facturé)
UPDATE "BonTravail" SET "statut" = 'EN_COURS' WHERE "statut" = 'PRET';
