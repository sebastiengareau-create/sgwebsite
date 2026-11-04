-- Poinçon de tâche interne ajouté à la main par le gérant : qui et quand
ALTER TABLE "EntreeTempsInterne" ADD COLUMN "ajoutePar" TEXT;
ALTER TABLE "EntreeTempsInterne" ADD COLUMN "ajouteLe" TIMESTAMP(3);
