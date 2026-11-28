// Visuel de l'Immobilier, sans base de données : moment de la journée et
// saison au Québec, conseil du mois du propriétaire, étages et état des
// logements. Utilisé par la rue illustrée du tableau de bord et les façades
// des immeubles (app/components/RueIllustree.js) et par le plan des étages de la
// fiche d'un immeuble.

import { etatFinBail } from "./immobilierCalculs";

// Lever et coucher du soleil approximatifs à Montréal, par mois (heure locale,
// heure avancée comprise) — assez pour choisir la couleur du ciel
const LEVER = [7.4, 7.0, 7.0, 6.3, 5.5, 5.1, 5.3, 6.0, 6.6, 7.2, 6.9, 7.5];
const COUCHER = [16.6, 17.3, 19.0, 19.7, 20.3, 20.7, 20.6, 20.0, 19.1, 18.2, 16.5, 16.2];

function partiesQuebec(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" })
    .formatToParts(date).map((x) => [x.type, x.value]));
  return { mois: Number(p.month), heure: Number(p.hour) + Number(p.minute) / 60 };
}

// { moment: "matin" | "jour" | "soir" | "nuit", saison: "hiver" | "printemps" | "ete" | "automne", mois (1 à 12), salutation }
export function momentQuebec(date = new Date()) {
  const { mois, heure } = partiesQuebec(date);
  const lever = LEVER[mois - 1];
  const coucher = COUCHER[mois - 1];
  let moment = "jour";
  if (heure < lever - 0.5 || heure >= coucher + 1) moment = "nuit";
  else if (heure < lever + 2) moment = "matin";
  else if (heure >= coucher - 1.5) moment = "soir";
  const saison = [12, 1, 2, 3].includes(mois) ? "hiver" : mois <= 5 ? "printemps" : mois <= 8 ? "ete" : "automne";
  const salutation = heure >= 18 || heure < 4 ? "Bonsoir" : "Bonjour";
  return { moment, saison, mois, salutation };
}

// Le calendrier du propriétaire au Québec : un rappel par mois
export const CONSEILS_MOIS = [
  { texte: "C'est la saison des avis de modification : pour un bail de 12 mois qui finit le 30 juin, l'avis part entre le 1er janvier et le 31 mars.", href: "/immobilier/locataires", lien: "Voir les baux" },
  { texte: "Relevés 31 : à remettre à chaque locataire au plus tard le dernier jour de février.", href: "/immobilier/releve-31", lien: "Relevés 31" },
  { texte: "Dernier mois pour envoyer les avis de modification des baux du 1er juillet ; le locataire a un mois pour répondre.", href: "/immobilier/locataires", lien: "Voir les baux" },
  { texte: "Un locataire ne renouvelle pas ? Le printemps est le meilleur moment pour annoncer le logement et faire les visites.", href: "/immobilier/immeubles", lien: "Logements" },
  { texte: "Inspection de printemps après le dégel : toiture, gouttières, drain et fondation.", href: "/immobilier/entretien", lien: "Entretien" },
  { texte: "Le 1er juillet approche : clés, états des lieux d'entrée et de sortie, abonnements d'Hydro-Québec des locataires.", href: "/immobilier/locataires", lien: "Voir les baux" },
  { texte: "Après le 1er juillet : terminer les états des lieux et faire signer le bail officiel de chaque nouveau locataire.", href: "/immobilier/locataires", lien: "Voir les baux" },
  { texte: "Ramonage et entretien du chauffage avant l'automne, pendant que les entrepreneurs ont encore de la place.", href: "/immobilier/entretien", lien: "Entretien" },
  { texte: "Rentrée : teste les avertisseurs de fumée et de monoxyde de carbone de chaque logement.", href: "/immobilier/entretien", lien: "Entretien" },
  { texte: "Avant le gel : gouttières nettoyées, robinets extérieurs fermés, coupe-froid des portes et fenêtres vérifiés.", href: "/immobilier/entretien", lien: "Entretien" },
  { texte: "Contrat de déneigement signé ? Stationnement, entrées et escaliers extérieurs doivent rester sûrs tout l'hiver.", href: "/immobilier/depenses", lien: "Dépenses" },
  { texte: "Prépare janvier : le calcul des hausses de loyer selon la méthode du TAL, immeuble par immeuble.", href: "/immobilier/immeubles", lien: "Immeubles" },
];

// ---------- Étages ----------

// Étage lisible et rang : le haut de l'immeuble d'abord, le rez-de-chaussée
// puis le sous-sol en bas. Texte libre dans la fiche du logement (« RC »,
// « 2 », « Sous-sol »…).
export function etageDe(etage) {
  const t = (etage || "").trim();
  if (!t) return null;
  const bas = t.toLowerCase();
  if (/^(sous|ss\b|s-s|-)/.test(bas)) return { rang: -1, label: "Sous-sol" };
  if (/^(rc|rdc|rez|0$)/.test(bas)) return { rang: 0, label: "Rez-de-chaussée" };
  const n = parseInt(bas, 10);
  if (Number.isFinite(n)) return { rang: n, label: `Étage ${n}` };
  return { rang: 0.5, label: t };
}

export const comparerNumeros = (a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true });

// Logements regroupés par étage, du haut vers le bas ; sans étage noté
// nulle part, un seul groupe sans titre
export function etagesDe(logements) {
  if (!logements.some((l) => etageDe(l.etage))) return [{ cle: "tous", label: null, logements: [...logements].sort(comparerNumeros) }];
  const groupes = new Map();
  for (const l of logements) {
    const e = etageDe(l.etage) || (l.type === "LOGEMENT" || l.type === "COMMERCIAL" ? { rang: -2, label: "Étage non indiqué" } : { rang: -3, label: "Autres espaces" });
    if (!groupes.has(e.label)) groupes.set(e.label, { cle: e.label, label: e.label, rang: e.rang, logements: [] });
    groupes.get(e.label).logements.push(l);
  }
  return [...groupes.values()].sort((a, b) => b.rang - a.rang).map((g) => ({ ...g, logements: g.logements.sort(comparerNumeros) }));
}

// ---------- État d'un logement ----------

const BAUX_A_SURVEILLER = ["ECHU", "AVIS_A_ENVOYER"];

// « RETARD » | « VACANT » | « SURVEILLER » | « OK », du plus pressant au plus calme
export function etatLogement(bail, compte) {
  if (!bail) return "VACANT";
  if ((compte?.enRetard || 0) > 0.005) return "RETARD";
  const fin = etatFinBail(bail);
  if (BAUX_A_SURVEILLER.includes(fin.code) || (fin.code === "AVIS_ENVOYE" && ["REFUSE", "QUITTE"].includes(bail.reponseAvis))) return "SURVEILLER";
  return "OK";
}

// ---------- Rangées de fenêtres d'un immeuble (pour la façade illustrée) ----------

const HABITABLES = ["LOGEMENT", "COMMERCIAL"];
const ETAGES_MAX = 8;
const PAR_ETAGE_MAX = 5;

const morceaux = (liste, n) => Array.from({ length: Math.ceil(liste.length / n) }, (_, i) => liste.slice(i * n, i * n + n));

// Logements d'un immeuble répartis en rangées, du rez-de-chaussée vers le
// haut : { rangees: [[logement…]…], sousSol: [logement…], commercesAuRc }.
// Selon les étages notés dans les fiches ; sinon, selon le type d'immeuble
// (plex : un logement par étage jusqu'à trois, deux ensuite ; multilogement :
// trois à cinq par étage ; mixte : les commerces au rez-de-chaussée).
export function rangeesImmeuble(immeuble) {
  const unites = (immeuble.logements || []).filter((l) => HABITABLES.includes(l.type)).sort(comparerNumeros);
  const commerces = unites.filter((l) => l.type === "COMMERCIAL");
  // Multilogement et immeuble en copropriété (« CONDO ») : plusieurs unités par étage
  const parEtage = (n) => (["MULTILOGEMENT", "CONDO"].includes(immeuble.type) ? (n >= 16 ? 5 : n >= 9 ? 4 : 3) : n >= 4 ? 2 : 1);
  let rangees;
  let sousSol = [];
  if (unites.some((l) => etageDe(l.etage))) {
    const parRang = new Map();
    const sansEtage = [];
    for (const l of unites) {
      const e = etageDe(l.etage);
      if (!e) sansEtage.push(l);
      else if (e.rang < 0) sousSol.push(l);
      else parRang.set(e.rang, [...(parRang.get(e.rang) || []), l]);
    }
    rangees = [...parRang.entries()].sort((a, b) => a[0] - b[0]).map(([, ls]) => ls);
    // Sans étage noté : sur l'étage le moins rempli
    for (const l of sansEtage) {
      if (rangees.length === 0) rangees.push([]);
      rangees.reduce((min, r) => (r.length < min.length ? r : min)).push(l);
    }
  } else if (commerces.length > 0 && commerces.length < unites.length) {
    const logements = unites.filter((l) => l.type !== "COMMERCIAL");
    rangees = [commerces, ...morceaux(logements, parEtage(logements.length))];
  } else {
    rangees = morceaux(unites, parEtage(unites.length));
  }
  rangees = rangees.filter((r) => r.length > 0).slice(0, ETAGES_MAX).map((r) => r.slice(0, PAR_ETAGE_MAX));
  sousSol = sousSol.slice(0, PAR_ETAGE_MAX);
  if (rangees.length === 0) rangees = [[]];
  return { rangees, sousSol, commercesAuRc: rangees[0].length > 0 && rangees[0].every((l) => l.type === "COMMERCIAL") };
}

// Petit générateur pseudo-aléatoire stable (même immeuble = même dessin)
export function graine(texte) {
  let h = 2166136261;
  for (const c of String(texte || "")) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
