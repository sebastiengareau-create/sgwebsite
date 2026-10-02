-- Code-barres du fabricant (UPC/EAN) : scanner la boîte d'origine retrouve
-- la pièce sans avoir à la réétiqueter.
ALTER TABLE "Piece" ADD COLUMN "codeBarre" TEXT;

CREATE UNIQUE INDEX "Piece_codeBarre_key" ON "Piece"("codeBarre");
