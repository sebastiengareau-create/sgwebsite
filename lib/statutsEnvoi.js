// Constantes des envois de bons aux employés — sans dépendance au serveur,
// donc utilisables aussi dans les composants du navigateur.

// Étapes d'un envoi de bon à un employé, dans l'ordre. L'employé avance
// lui-même de VU à TERMINE dans « Mes tâches » ; ANNULE vient du bureau.
const STATUTS_ENVOI = {
  ENVOYE: { label: "Envoyé", color: "#C9A227" },
  VU: { label: "Vu", color: "#4F82C0" },
  EN_ROUTE: { label: "En route", color: "#9A7FC7" },
  SUR_PLACE: { label: "Sur place", color: "#3FA7A0" },
  TERMINE: { label: "Terminé", color: "#6FA96B" },
  ANNULE: { label: "Annulé", color: "#8a8a8a" },
};
const STATUTS_ACTIFS = ["ENVOYE", "VU", "EN_ROUTE", "SUR_PLACE"];
// Étapes que l'employé peut choisir lui-même
const STATUTS_EMPLOYE = ["VU", "EN_ROUTE", "SUR_PLACE", "TERMINE"];

const LIBELLES_SMS = {
  ENVOYE: "SMS envoyé",
  ECHEC: "SMS en échec",
  SANS_TELEPHONE: "Aucun cellulaire au dossier",
  NON_CONFIGURE: "SMS non configuré",
};

const CANAUX_AVIS = { PUSH: "🔔 notification", SMS: "💬 SMS", COURRIEL: "✉️ courriel" };

// Résumé de l'avis d'un envoi : { texte, ok }
function resumeAvis({ avisPar = [], smsStatut, smsErreur }) {
  const canaux = avisPar.length > 0 ? avisPar : smsStatut === "ENVOYE" ? ["SMS"] : [];
  if (canaux.length > 0) return { ok: true, texte: `Avisé par ${canaux.map((c) => CANAUX_AVIS[c]).join(", ")}` };
  const detailSms = smsStatut && smsStatut !== "NON_CONFIGURE" ? ` · ${LIBELLES_SMS[smsStatut]}${smsErreur ? ` (${smsErreur})` : ""}` : "";
  return { ok: false, texte: `⚠️ Non avisé — notifications pas activées${detailSms}` };
}

module.exports = { STATUTS_ENVOI, STATUTS_ACTIFS, STATUTS_EMPLOYE, LIBELLES_SMS, resumeAvis };
