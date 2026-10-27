-- Numéros de téléphone déjà enregistrés : mis sous la forme (450) 555-1234,
-- comme ceux enregistrés désormais (lib/telephone.js). Seuls les numéros
-- nord-américains complets, sans poste, sont touchés ; le reste ne change pas.

UPDATE "User" SET "telephone" = '(' || substr(right(regexp_replace("telephone", '\D', '', 'g'), 10), 1, 3) || ') ' || substr(right(regexp_replace("telephone", '\D', '', 'g'), 10), 4, 3) || '-' || substr(right(regexp_replace("telephone", '\D', '', 'g'), 10), 7, 4)
WHERE "telephone" ~ '^\s*(\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\s*$';

UPDATE "Client" SET "telephone" = '(' || substr(right(regexp_replace("telephone", '\D', '', 'g'), 10), 1, 3) || ') ' || substr(right(regexp_replace("telephone", '\D', '', 'g'), 10), 4, 3) || '-' || substr(right(regexp_replace("telephone", '\D', '', 'g'), 10), 7, 4)
WHERE "telephone" ~ '^\s*(\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\s*$';

UPDATE "Fournisseur" SET "telephone" = '(' || substr(right(regexp_replace("telephone", '\D', '', 'g'), 10), 1, 3) || ') ' || substr(right(regexp_replace("telephone", '\D', '', 'g'), 10), 4, 3) || '-' || substr(right(regexp_replace("telephone", '\D', '', 'g'), 10), 7, 4)
WHERE "telephone" ~ '^\s*(\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\s*$';

UPDATE "Soumission" SET "clientTelephone" = '(' || substr(right(regexp_replace("clientTelephone", '\D', '', 'g'), 10), 1, 3) || ') ' || substr(right(regexp_replace("clientTelephone", '\D', '', 'g'), 10), 4, 3) || '-' || substr(right(regexp_replace("clientTelephone", '\D', '', 'g'), 10), 7, 4)
WHERE "clientTelephone" ~ '^\s*(\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\s*$';

UPDATE "RendezVous" SET "clientTelephone" = '(' || substr(right(regexp_replace("clientTelephone", '\D', '', 'g'), 10), 1, 3) || ') ' || substr(right(regexp_replace("clientTelephone", '\D', '', 'g'), 10), 4, 3) || '-' || substr(right(regexp_replace("clientTelephone", '\D', '', 'g'), 10), 7, 4)
WHERE "clientTelephone" ~ '^\s*(\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\s*$';

UPDATE "Parametre" SET "valeur" = '(' || substr(right(regexp_replace("valeur", '\D', '', 'g'), 10), 1, 3) || ') ' || substr(right(regexp_replace("valeur", '\D', '', 'g'), 10), 4, 3) || '-' || substr(right(regexp_replace("valeur", '\D', '', 'g'), 10), 7, 4)
WHERE "valeur" ~ '^\s*(\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\s*$' AND "cle" = 'entreprise_telephone';
