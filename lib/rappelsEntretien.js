// Rappels d'entretien : un courriel aux clients dont le véhicule n'est pas
// revenu depuis un certain nombre de mois (réglable, 6 par défaut).
//
// Un véhicule est « à relancer » quand :
//  - son dernier bon date d'au moins ce nombre de mois (et d'au plus 2 ans
//    de plus : au-delà, le client est considéré comme parti) ;
//  - ce dernier bon est terminé (aucun travail en cours) ;
//  - aucun rappel ne lui a été envoyé depuis cette visite — un seul rappel
//    par visite, jamais de relances répétées ;
//  - son propriétaire n'a pas de rendez-vous à venir.
// Le rappel part seulement si le client a un courriel et ne s'est pas
// désabonné des promotions : c'est un message commercial (loi anti-pourriel),
// il porte donc le lien de désabonnement (lib/courrielDocuments.js).
//
// Envoi à la main depuis Clients → Rappels d'entretien, ou automatique
// (réglage sur la même page) : une fois par jour, en journée, au plus
// MAX_PAR_JOUR clients — pour étaler les envois à la mise en marche.
import { prisma } from "./prisma";
import { obtenirInfosEntreprise } from "./config";
import { libelleVehicule } from "./vehicules";
import { nombre } from "./format";
import { dateAujourdhuiQuebec, FUSEAU } from "./temps";
import { courrielConfigure, courrielValide, preparerCourriel, envoyerCourriels } from "./courrielDocuments";

const CLE_MOIS = "rappel_entretien_mois";
const CLE_AUTO = "rappel_entretien_auto";
const CLE_LIEN = "rappel_entretien_lien";
const CLE_DERNIER_ENVOI_AUTO = "rappel_entretien_dernier_envoi_auto";
export const MOIS_DEFAUT = 6;
const MOIS_MAX_APRES = 24;
const MAX_PAR_JOUR = 40;

const DATE_LONGUE = new Intl.DateTimeFormat("fr-CA", { timeZone: FUSEAU, day: "numeric", month: "long", year: "numeric" });

export async function lireReglagesRappels() {
  const lignes = await prisma.parametre.findMany({ where: { cle: { in: [CLE_MOIS, CLE_AUTO, CLE_LIEN] } } });
  const dict = Object.fromEntries(lignes.map((l) => [l.cle, l.valeur]));
  const mois = Math.round(Number(dict[CLE_MOIS]));
  return {
    mois: mois >= 1 && mois <= 36 ? mois : MOIS_DEFAUT,
    auto: dict[CLE_AUTO] === "actif",
    lien: dict[CLE_LIEN] || "", // adresse où prendre rendez-vous en ligne, ajoutée au courriel
  };
}

export async function enregistrerReglagesRappels({ mois, auto, lien }) {
  const valeurs = {};
  if (mois !== undefined) {
    const n = Math.round(Number(mois));
    if (!(n >= 1 && n <= 36)) return { erreur: "Le délai doit être de 1 à 36 mois." };
    valeurs[CLE_MOIS] = String(n);
  }
  if (lien !== undefined) {
    const adresse = String(lien || "").trim();
    if (adresse && !/^https?:\/\/\S+$/i.test(adresse)) return { erreur: "Le lien de réservation doit commencer par http:// ou https://." };
    valeurs[CLE_LIEN] = adresse.slice(0, 300);
  }
  if (auto !== undefined) {
    if (auto && !courrielConfigure()) return { erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant)." };
    valeurs[CLE_AUTO] = auto ? "actif" : "inactif";
  }
  await prisma.$transaction(Object.entries(valeurs).map(([cle, valeur]) => prisma.parametre.upsert({ where: { cle }, update: { valeur }, create: { cle, valeur } })));
  return { ok: true };
}

function moisAvant(date, mois) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - mois);
  return d;
}

// Véhicules à relancer, le plus ancien d'abord. etat : "PRET" (le rappel
// peut partir), "SANS_COURRIEL" ou "DESABONNE" (montrés à l'écran, pour
// appeler le client au besoin).
export async function vehiculesARelancer({ mois }) {
  const maintenant = new Date();
  const limite = moisAvant(maintenant, mois);
  const plancher = moisAvant(maintenant, mois + MOIS_MAX_APRES);
  const visite = { comptoir: false };

  const vehicules = await prisma.vehicule.findMany({
    where: {
      vehiculeVente: null, // pas un véhicule à vendre de l'entreprise
      bons: { some: { ...visite, creeLe: { gte: plancher, lte: limite } }, none: { ...visite, creeLe: { gt: limite } } },
      client: { rendezVous: { none: { date: { gte: maintenant }, statut: "CONFIRME" } } },
    },
    select: {
      id: true, annee: true, marque: true, modele: true, version: true, plaque: true, kilometrage: true, rappelEntretienLe: true,
      client: { select: { id: true, nom: true, courriel: true, telephone: true, promotionsRefuseesLe: true } },
      bons: {
        where: visite, orderBy: { creeLe: "desc" }, take: 1,
        select: { id: true, numero: true, statut: true, creeLe: true, kilometrage: true, problemes: { select: { description: true }, orderBy: { id: "asc" }, take: 3 } },
      },
    },
  });

  return vehicules
    .map((v) => {
      const bon = v.bons[0];
      const courriel = (v.client.courriel || "").trim();
      return {
        id: v.id,
        vehicule: libelleVehicule(v) || v.plaque || "Véhicule",
        plaque: v.plaque,
        kilometrage: bon.kilometrage ?? v.kilometrage,
        client: { id: v.client.id, nom: v.client.nom, courriel, telephone: v.client.telephone },
        derniereVisite: bon.creeLe,
        bon: { id: bon.id, numero: bon.numero, statut: bon.statut, travaux: bon.problemes.map((p) => p.description) },
        dejaRappele: !!v.rappelEntretienLe && v.rappelEntretienLe >= bon.creeLe,
        etat: v.client.promotionsRefuseesLe ? "DESABONNE" : courrielValide(courriel) ? "PRET" : "SANS_COURRIEL",
      };
    })
    .filter((v) => v.bon.statut === "TERMINE" && !v.dejaRappele)
    .sort((a, b) => a.derniereVisite - b.derniereVisite);
}

// Texte du rappel pour un client (un ou plusieurs véhicules)
export function texteRappel({ nomClient, vehicules, entreprise, lien }) {
  const lignes = vehicules.map((v) => {
    const km = v.kilometrage ? `, à ${nombre(v.kilometrage, 0)} km` : "";
    return `${v.vehicule} : dernière visite le ${DATE_LONGUE.format(new Date(v.derniereVisite))}${km}`;
  });
  const un = vehicules.length === 1;
  const contact = [
    lien && `Pour prendre rendez-vous en ligne : ${lien}`,
    entreprise.telephone && `${lien ? "Ou appelez-nous" : "Pour prendre rendez-vous, appelez-nous"} au ${entreprise.telephone}.`,
    !lien && !entreprise.telephone && "Pour prendre rendez-vous, répondez simplement à ce courriel.",
  ].filter(Boolean).join("\n");
  return {
    sujet: un ? `Un entretien à prévoir pour votre ${vehicules[0].vehicule}` : "Un entretien à prévoir pour vos véhicules",
    texte: `Bonjour ${nomClient},\n\n${un ? "Cela fait un moment que nous n'avons pas vu votre véhicule" : "Cela fait un moment que nous n'avons pas vu vos véhicules"} :\n\n${lignes.map((l) => `• ${l}`).join("\n")}\n\nUn entretien régulier évite les mauvaises surprises et les réparations coûteuses. C'est peut-être le bon moment pour ${un ? "le" : "les"} faire vérifier.\n\n${contact}\n\nMerci de votre confiance,\n${entreprise.nomEntreprise}`,
  };
}

// Envoie les rappels des véhicules donnés (parmi ceux à relancer et prêts) —
// un seul courriel par client, même avec plusieurs véhicules. vehiculeIds
// absent : tous, jusqu'à maxClients.
// → { envoyes (clients), vehicules, echecs: [{ a, erreur }] } ou { erreur }
export async function envoyerRappels({ vehiculeIds = null, maxClients = Infinity } = {}) {
  if (!courrielConfigure()) return { erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant)." };
  const reglages = await lireReglagesRappels();
  const choisis = vehiculeIds ? new Set(vehiculeIds) : null;
  const prets = (await vehiculesARelancer(reglages)).filter((v) => v.etat === "PRET" && (!choisis || choisis.has(v.id)));

  const parClient = new Map();
  for (const v of prets) {
    if (!parClient.has(v.client.id) && parClient.size >= maxClients) continue;
    if (!parClient.has(v.client.id)) parClient.set(v.client.id, { client: v.client, vehicules: [] });
    parClient.get(v.client.id).vehicules.push(v);
  }
  if (parClient.size === 0) return { envoyes: 0, vehicules: 0, echecs: [] };

  const entreprise = await obtenirInfosEntreprise();
  const groupes = [...parClient.values()];
  const courriels = groupes.map(({ client, vehicules }) => {
    const { sujet, texte } = texteRappel({ nomClient: client.nom, vehicules, entreprise, lien: reglages.lien });
    return preparerCourriel({ a: client.courriel, sujet, texte, entreprise, clientId: client.id });
  });
  const { envoyes, echecs } = await envoyerCourriels(courriels);

  // Noté seulement pour les courriels partis : un envoi refusé sera repris
  const rates = new Set(echecs.map((e) => e.a));
  const idsEnvoyes = groupes.filter((g) => !rates.has(g.client.courriel)).flatMap((g) => g.vehicules.map((v) => v.id));
  if (idsEnvoyes.length > 0) await prisma.vehicule.updateMany({ where: { id: { in: idsEnvoyes } }, data: { rappelEntretienLe: new Date() } });
  return { envoyes, vehicules: idsEnvoyes.length, echecs };
}

// Envoi automatique (lib/planificateurSauvegarde.js, chaque heure) : une
// fois par jour, entre 9 h et 17 h, si le réglage est actif
export async function verifierRappelsEntretienAuto() {
  const heure = Number(new Intl.DateTimeFormat("en-US", { timeZone: FUSEAU, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  if (heure < 9 || heure >= 17 || !courrielConfigure()) return;
  if (!(await lireReglagesRappels()).auto) return;
  const aujourdhui = dateAujourdhuiQuebec();
  const dernier = await prisma.parametre.findUnique({ where: { cle: CLE_DERNIER_ENVOI_AUTO } });
  if (dernier?.valeur === aujourdhui) return;
  // Noté avant l'envoi : un redémarrage en plein envoi ne renvoie rien en double
  await prisma.parametre.upsert({ where: { cle: CLE_DERNIER_ENVOI_AUTO }, update: { valeur: aujourdhui }, create: { cle: CLE_DERNIER_ENVOI_AUTO, valeur: aujourdhui } });
  const resultat = await envoyerRappels({ maxClients: MAX_PAR_JOUR });
  if (resultat.envoyes > 0 || resultat.echecs?.length > 0) {
    console.log(`Rappels d'entretien : ${resultat.envoyes} envoyé(s), ${resultat.echecs.length} refusé(s).`);
  }
}
