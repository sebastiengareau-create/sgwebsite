// ============================================================
// ENVOI DE SMS (Twilio)
// ============================================================
// Appel direct de l'API REST de Twilio (pas de dépendance à ajouter).
// Configuré dans l'app : Administrateur → SMS (Twilio), gardé dans la table
// Parametre (le jeton n'est jamais renvoyé au navigateur ni mis dans les
// sauvegardes). À défaut, les variables d'environnement TWILIO_ACCOUNT_SID,
// TWILIO_AUTH_TOKEN, TWILIO_NUMERO et APP_URL servent encore.
// Sans configuration, rien n'est envoyé : l'appelant reçoit { statut:
// "NON_CONFIGURE" } et le reste fonctionne quand même.
// ============================================================

const { prisma } = require("./prisma");

// champ → clé de la table Parametre
const CLES_SMS = {
  accountSid: "twilio_account_sid",
  authToken: "twilio_auth_token",
  numero: "twilio_numero",
  adressePublique: "app_url_publique",
};
const VARIABLES_ENV = { accountSid: "TWILIO_ACCOUNT_SID", authToken: "TWILIO_AUTH_TOKEN", numero: "TWILIO_NUMERO", adressePublique: "APP_URL" };

async function lireConfigSms() {
  const lignes = await prisma.parametre.findMany({ where: { cle: { in: Object.values(CLES_SMS) } } });
  const dict = Object.fromEntries(lignes.map((l) => [l.cle, l.valeur]));
  const config = {};
  for (const [champ, cle] of Object.entries(CLES_SMS)) {
    config[champ] = (dict[cle] || process.env[VARIABLES_ENV[champ]] || "").trim();
  }
  config.adressePublique = config.adressePublique.replace(/\/+$/, "") || "http://localhost:3000";
  return config;
}

function estConfigure(config) {
  return !!(config.accountSid && config.authToken && config.numero);
}

async function smsConfigure() {
  return estConfigure(await lireConfigSms());
}

// Numéro saisi librement (« 514 555-0123 », « 1-514-555-0123 »…) →
// format international « +15145550123 ». null si on ne peut pas le lire.
function normaliserTelephone(brut) {
  const texte = String(brut || "").trim();
  if (!texte) return null;
  const chiffres = texte.replace(/\D/g, "");
  if (texte.startsWith("+")) return chiffres.length >= 8 ? `+${chiffres}` : null;
  if (chiffres.length === 10) return `+1${chiffres}`; // Amérique du Nord
  if (chiffres.length === 11 && chiffres.startsWith("1")) return `+${chiffres}`;
  return null;
}

// Retourne { statut: "ENVOYE" | "ECHEC" | "SANS_TELEPHONE" | "NON_CONFIGURE", erreur? }
async function envoyerSms(telephone, texte, config = null) {
  const numero = normaliserTelephone(telephone);
  if (!numero) return { statut: "SANS_TELEPHONE", erreur: telephone ? `Numéro illisible : « ${telephone} »` : null };
  const cfg = config || (await lireConfigSms());
  if (!estConfigure(cfg)) return { statut: "NON_CONFIGURE" };

  const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: numero, From: normaliserTelephone(cfg.numero) || cfg.numero, Body: texte }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { statut: "ECHEC", erreur: data.message || `Twilio a répondu ${res.status}` };
    }
    return { statut: "ENVOYE" };
  } catch (e) {
    return { statut: "ECHEC", erreur: e.message };
  }
}

module.exports = { CLES_SMS, lireConfigSms, smsConfigure, normaliserTelephone, envoyerSms };
