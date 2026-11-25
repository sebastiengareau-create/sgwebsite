-- Bail : stationnement extérieur et intérieur (section B du formulaire)
ALTER TABLE "BailImmo" ADD COLUMN "stationnementExterieur" INTEGER;
ALTER TABLE "BailImmo" ADD COLUMN "stationnementExterieurEmplacement" TEXT;
ALTER TABLE "BailImmo" ADD COLUMN "stationnementInterieur" INTEGER;
ALTER TABLE "BailImmo" ADD COLUMN "stationnementInterieurEmplacement" TEXT;
