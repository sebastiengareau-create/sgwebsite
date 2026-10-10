-- Envoi de SMS (Twilio) retiré : efface sa configuration (identifiants
-- Twilio et adresse publique saisis dans Administrateur → SMS). Les
-- colonnes smsStatut/smsErreur de EnvoiBon restent, pour l'historique.
DELETE FROM "Parametre" WHERE "cle" IN ('twilio_account_sid', 'twilio_auth_token', 'twilio_numero', 'app_url_publique');
