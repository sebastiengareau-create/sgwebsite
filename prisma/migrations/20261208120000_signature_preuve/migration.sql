-- Signature électronique : empreinte de la version signée et attestation de
-- réception du règlement de l'immeuble
ALTER TABLE "DocumentImmo" ADD COLUMN "empreinteSignee" TEXT;
ALTER TABLE "SignatureImmo" ADD COLUMN "reglementRecuLe" TIMESTAMP(3);

-- Versions signées déjà produites : leur empreinte
UPDATE "DocumentImmo" SET "empreinteSignee" = encode(sha256("donneesSignees"), 'hex') WHERE "donneesSignees" IS NOT NULL;
