// ============================================================
// ENVOI DE SMS (Twilio)
// ============================================================
// Appel direct de l'API REST de Twilio (pas de dépendance à ajouter).
// Variables Railway à fournir pour activer les SMS :
//   TWILIO_ACCOUNT_SID  — « Account SID » de la console Twilio (AC…)
//   TWILIO_AUTH_TOKEN   — « Auth Token » du même compte
//   TWILIO_NUMERO       — numéro Twilio qui envoie, ex. « +15145550123 »
// Sans elles, rien n'est envoyé : l'appelant reçoit { statut:
// "NON_CONFIGURE" } et le reste fonctionne quand même.
// ============================================================

function smsConfigure() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_NUMERO);
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
async function envoyerSms(telephone, texte) {
  const numero = normaliserTelephone(telephone);
  if (!numero) return { statut: "SANS_TELEPHONE", erreur: telephone ? `Numéro illisible : « ${telephone} »` : null };
  if (!smsConfigure()) return { statut: "NON_CONFIGURE" };

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: numero, From: process.env.TWILIO_NUMERO, Body: texte }),
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

module.exports = { smsConfigure, normaliserTelephone, envoyerSms };
