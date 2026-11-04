-- Poinçon de tâche interne ajusté à la main : heures d'origine, qui et quand
ALTER TABLE "EntreeTempsInterne" ADD COLUMN "debutOriginal" TIMESTAMP(3);
ALTER TABLE "EntreeTempsInterne" ADD COLUMN "finOriginal" TIMESTAMP(3);
ALTER TABLE "EntreeTempsInterne" ADD COLUMN "modifiePar" TEXT;
ALTER TABLE "EntreeTempsInterne" ADD COLUMN "modifieLe" TIMESTAMP(3);

-- Heures réellement travaillées par un employé une journée (rapports de productivité)
CREATE TABLE "HeuresJourEmploye" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "heures" DOUBLE PRECISION NOT NULL,
    "modifiePar" TEXT,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeuresJourEmploye_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HeuresJourEmploye_employeId_date_key" ON "HeuresJourEmploye"("employeId", "date");

ALTER TABLE "HeuresJourEmploye" ADD CONSTRAINT "HeuresJourEmploye_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
