-- Nouvelle section « Notifications » (Administrateur → Rôles et accès) :
-- envoyer un message et choisir qui reçoit quoi — jusqu'ici réservé au
-- gérant. Un gérant dont les sections ont déjà été réglées la garde.
UPDATE "Parametre"
SET "valeur" = CASE WHEN TRIM("valeur") = '' THEN 'notifications' ELSE "valeur" || ',notifications' END
WHERE "cle" = 'role_defaut_GERANT'
  AND NOT ('notifications' = ANY (string_to_array(REPLACE("valeur", ' ', ''), ',')));
