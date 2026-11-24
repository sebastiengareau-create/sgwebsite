// Textos au client. Sans le module Textos automatiques (lib/textosAuto.js,
// Twilio), le texto part du téléphone, sans abonnement : un lien « sms: » ouvre l'appli
// Messages du téléphone avec le numéro et le message déjà écrits — la
// personne n'a qu'à appuyer sur Envoyer. Le texto part du téléphone de
// l'atelier ou de l'employé ; rien ne passe par un service payant.
// Sans dépendance au serveur (utilisé dans le navigateur).

// Numéro composable pour un texto : +1 et 10 chiffres pour un numéro
// nord-américain, sinon les chiffres tels quels — ou null si inutilisable
export function numeroTexto(telephone) {
  const sansPoste = String(telephone || "").replace(/\s*(poste|post\.?|ext\.?|x|#)\s*\d+\s*$/i, "");
  const chiffres = sansPoste.replace(/\D/g, "");
  if (chiffres.length === 10) return `+1${chiffres}`;
  if (chiffres.length === 11 && chiffres.startsWith("1")) return `+${chiffres}`;
  return chiffres.length >= 7 ? (sansPoste.trim().startsWith("+") ? `+${chiffres}` : chiffres) : null;
}

// Lien « sms: » — iPhone et iPad attendent « & » avant le message, les
// autres « ? »
export function lienTexto(telephone, message, userAgent = "") {
  const numero = numeroTexto(telephone);
  if (!numero) return null;
  const apple = /iPhone|iPad|iPod|Macintosh/.test(userAgent);
  return `sms:${numero}${message ? `${apple ? "&" : "?"}body=${encodeURIComponent(message)}` : ""}`;
}

// Numéro en format international (+1XXXXXXXXXX), exigé pour un envoi par
// Twilio (textos automatiques) — ou null
export function numeroE164(telephone) {
  const numero = numeroTexto(telephone);
  return numero && numero.startsWith("+") ? numero : null;
}

// +15145551234 → « 514 555-1234 » (les autres numéros, tels quels)
export function numeroLisible(numero) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(String(numero || ""));
  return m ? `${m[1]} ${m[2]}-${m[3]}` : String(numero || "");
}

// Ajoutée à la fin des textos automatiques et des rappels (loi canadienne
// anti-pourriel : un moyen simple de se désabonner)
export const MENTION_ARRET = "Répondez ARRET pour ne plus recevoir nos textos.";
// Types d'envoi qui la reçoivent (envois automatiques et rappels, qui sont
// de la promotion) — voir lib/textosAuto.js
export const TYPES_AVEC_MENTION = ["VEHICULE_PRET", "RAPPEL_RDV", "RAPPEL"];

// Nombre de textos facturés pour un message : 160 caractères par texto (153
// s'il en faut plusieurs) avec l'alphabet de base des textos ; dès qu'un
// caractère en sort (ê, â, ç, î, ô, émoji…), 70 (67 s'il en faut plusieurs)
const GSM = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_ETENDU = "^{}\\[~]|€";
export function segmentsTexto(texte) {
  const t = String(texte || "");
  if (!t) return 0;
  let gsm = 0;
  for (const c of t) {
    if (GSM.includes(c)) gsm += 1;
    else if (GSM_ETENDU.includes(c)) gsm += 2;
    else {
      const unites = t.length; // UTF-16, comme le compte l'opérateur
      return unites <= 70 ? 1 : Math.ceil(unites / 67);
    }
  }
  return gsm <= 160 ? 1 : Math.ceil(gsm / 153);
}

// « le jeudi 12 novembre à 9 h 30 » (« à 9 h » pour une heure pile)
const FORMAT_QUAND = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
export function quandRendezVous(date) {
  const p = Object.fromEntries(FORMAT_QUAND.formatToParts(new Date(date)).map((x) => [x.type, x.value]));
  return `le ${p.weekday} ${p.day} ${p.month} à ${Number(p.hour)} h${p.minute === "00" ? "" : ` ${p.minute}`}`;
}

const prenom = (nom) => String(nom || "").trim().split(/\s+/)[0] || "";
const bonjour = (nom) => (prenom(nom) ? `Bonjour ${prenom(nom)}` : "Bonjour");
const signature = (nomEntreprise) => (nomEntreprise ? ` — ${nomEntreprise}` : "");

// Messages préremplis, courts : un texto se lit en un coup d'œil
export const MESSAGES_TEXTO = {
  vehiculePret: ({ nom, vehicule, lienPaiement, nomEntreprise }) =>
    `${bonjour(nom)}, votre ${vehicule || "véhicule"} est prêt, vous pouvez venir le chercher.${lienPaiement ? ` Vous pouvez aussi payer votre facture en ligne : ${lienPaiement}` : ""}${signature(nomEntreprise)}`,
  soumission: ({ nom, numero, lien, nomEntreprise }) =>
    `${bonjour(nom)}, voici votre soumission ${numero}. Vous pouvez la consulter et l'approuver ici : ${lien}${signature(nomEntreprise)}`,
  inspection: ({ nom, vehicule, lien, nomEntreprise }) =>
    `${bonjour(nom)}, voici le rapport d'inspection de votre ${vehicule || "véhicule"}, avec les photos et les travaux recommandés : ${lien}${signature(nomEntreprise)}`,
  pneus: ({ nom, hiver, vehicule, remplacer, nomEntreprise }) =>
    `${bonjour(nom)}, c'est le temps de poser vos pneus ${hiver ? "d'hiver" : "d'été"}${vehicule ? ` sur votre ${vehicule}` : ""} : ils sont entreposés chez nous.${remplacer ? " Nous avions noté au dépôt qu'ils sont à remplacer : nous pouvons vous préparer une soumission pour des pneus neufs." : ""} Voulez-vous prendre rendez-vous ?${signature(nomEntreprise)}`,
  // Jeu entreposé noté à remplacer (usure, âge, pneu endommagé)
  pneusARemplacer: ({ nom, libelle, raison, nomEntreprise }) =>
    `${bonjour(nom)}, à l'entreposage de vos ${libelle}, nous avons noté qu'ils sont à remplacer (${raison}). Voulez-vous une soumission pour des pneus neufs ?${signature(nomEntreprise)}`,
  paiement: ({ nom, numero, solde, lien, nomEntreprise }) =>
    `${bonjour(nom)}, voici votre facture ${numero} (${solde}). Vous pouvez la payer en ligne, par carte : ${lien}${signature(nomEntreprise)}`,
  portail: ({ nom, lien, nomEntreprise }) =>
    `${bonjour(nom)}, voici le lien de votre dossier en ligne : factures, travaux en cours, rendez-vous et véhicules. ${lien}${signature(nomEntreprise)}`,
  rappelRendezVous: ({ nom, quand, nomEntreprise }) =>
    `${bonjour(nom)}, petit rappel de votre rendez-vous ${quand}. Pour le déplacer, répondez à ce message.${signature(nomEntreprise)}`,
  rappelEntretien: ({ nom, vehicule, nomEntreprise }) =>
    `${bonjour(nom)}, cela fait un moment que nous n'avons pas vu votre ${vehicule || "véhicule"}. Un entretien serait peut-être à prévoir : voulez-vous prendre rendez-vous ?${signature(nomEntreprise)}`,
  // Réponse automatique quand l'atelier ne reçoit pas les réponses par texto
  reponsesFermees: ({ telephone, nomEntreprise }) =>
    `Ce numéro ne reçoit pas les réponses.${telephone ? ` Pour nous joindre : ${telephone}.` : ""}${signature(nomEntreprise)}`,
  arret: ({ nomEntreprise }) =>
    `Vous ne recevrez plus de textos${nomEntreprise ? ` de ${nomEntreprise}` : ""}. Répondez RETOUR pour les recevoir de nouveau.`,
  retour: ({ nomEntreprise }) =>
    `Vous recevrez de nouveau nos textos.${signature(nomEntreprise)}`,
};
