-- Copropriété : un budget par bâtiment — les quotes-parts font 100 % dans
-- chaque bâtiment, et le budget d'un bâtiment se répartit entre ses unités.
-- Les budgets existants restent ceux de la copropriété entière (batimentId
-- vide). Un budget par exercice et par bâtiment ; les budgets sans bâtiment
-- restent distincts entre eux, vérifié par l'appli.
-- DropIndex
DROP INDEX "BudgetCopro_annee_key";

-- AlterTable
ALTER TABLE "BudgetCopro" ADD COLUMN     "batimentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BudgetCopro_batimentId_annee_key" ON "BudgetCopro"("batimentId", "annee");

-- AddForeignKey
ALTER TABLE "BudgetCopro" ADD CONSTRAINT "BudgetCopro_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentCopro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
