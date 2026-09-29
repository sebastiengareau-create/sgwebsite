-- Une pièce qui n'est plus utilisée peut être désactivée : elle disparaît
-- des choix, mais garde son historique.
ALTER TABLE "Piece" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;
