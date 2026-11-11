// Textos au client sans abonnement : un lien « sms: » ouvre l'appli
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

const prenom = (nom) => String(nom || "").trim().split(/\s+/)[0] || "";
const bonjour = (nom) => (prenom(nom) ? `Bonjour ${prenom(nom)}` : "Bonjour");
const signature = (nomEntreprise) => (nomEntreprise ? ` — ${nomEntreprise}` : "");

// Messages préremplis, courts : un texto se lit en un coup d'œil
export const MESSAGES_TEXTO = {
  vehiculePret: ({ nom, vehicule, nomEntreprise }) =>
    `${bonjour(nom)}, votre ${vehicule || "véhicule"} est prêt, vous pouvez venir le chercher.${signature(nomEntreprise)}`,
  soumission: ({ nom, numero, lien, nomEntreprise }) =>
    `${bonjour(nom)}, voici votre soumission ${numero}. Vous pouvez la consulter et l'approuver ici : ${lien}${signature(nomEntreprise)}`,
  rappelRendezVous: ({ nom, quand, nomEntreprise }) =>
    `${bonjour(nom)}, petit rappel de votre rendez-vous ${quand}. Pour le déplacer, répondez à ce message.${signature(nomEntreprise)}`,
  rappelEntretien: ({ nom, vehicule, nomEntreprise }) =>
    `${bonjour(nom)}, cela fait un moment que nous n'avons pas vu votre ${vehicule || "véhicule"}. Un entretien serait peut-être à prévoir : voulez-vous prendre rendez-vous ?${signature(nomEntreprise)}`,
};
