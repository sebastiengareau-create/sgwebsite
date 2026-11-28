-- Copropriété : numéro d'unité unique dans son bâtiment, et non plus dans
-- toute la copropriété (une unité 101 dans chaque bâtiment). Les unités sans
-- bâtiment restent distinctes entre elles, vérifié par l'appli
-- (lib/copropriete.js, verifierNumeroUnite).
-- DropIndex
DROP INDEX "UniteCopro_numero_key";

-- CreateIndex
CREATE UNIQUE INDEX "UniteCopro_batimentId_numero_key" ON "UniteCopro"("batimentId", "numero");
