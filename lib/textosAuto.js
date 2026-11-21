// Textos automatiques (module « module_textos », inactif par défaut ;
// Administrateur → Modules), envoyés et reçus par Twilio. C'est une option
// payante : chaque texto coûte quelques dixièmes de cent chez Twilio, et le
// numéro d'envoi environ un dollar par mois.
//
// Chaque installation a son compte Twilio (ou un sous-compte) : clés et
// numéro d'envoi sont des variables de son projet Railway —
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, et TWILIO_NUMERO (+1XXXXXXXXXX) ou
// TWILIO_MESSAGING_SERVICE_SID. Sans le module, rien ne change : le bouton
// « 💬 Texto » ouvre l'appli Messages du téléphone (lib/textos.js).
//
// Ce qui s'active une chose à la fois dans Paramètres → Textos automatiques
// (réglage « textos_reglages ») :
//  - envoiDirect : les boutons « 💬 Texto » envoient le texto depuis
//    l'appli (lien de soumission, rapport d'inspection, facture à payer,
//    rappels…), sans passer par le téléphone ;
//  - vehiculePret : texto « véhicule prêt » à la facturation du bon (avec le
//    lien de paiement si le paiement en ligne est actif et qu'il reste un
//    solde) ;
//  - rappelRdv : rappel la veille du rendez-vous, dès l'heure choisie ;
//  - reponses : les réponses des clients arrivent dans l'appli (page
//    Textos), avec un avis à l'atelier. Sinon, une réponse automatique
//    donne le numéro de l'atelier.
//
// Un client qui répond ARRET (ou STOP) ne reçoit plus rien jusqu'à ce qu'il
// réponde RETOUR (ou START). Les avis de Twilio (/api/twilio/entrant et
// /api/twilio/statut) sont signés avec TWILIO_AUTH_TOKEN.
import crypto from "crypto";
import { prisma } from "./prisma";
import { lireParametre } from "./parametres";
import { notifier } from "./notifications";
import { obtenirInfosEntreprise } from "./config";
import { numeroE164, numeroLisible, MESSAGES_TEXTO, MENTION_ARRET, TYPES_AVEC_MENTION, quandRendezVous } from "./textos";
import { libelleVehicule } from "./vehicules";
import { nomClientBon } from "./nomClient";
import { dateAujourdhuiQuebec, limitesJourQuebec } from "./temps";
import { paiementEnLigneActif, assurerLienPaiement } from "./paiementEnLigne";
import { soldeFacture } from "./paiementsFactures";

export const CLE_MODULE_TEXTOS = "module_textos";
export const CLE_REGLAGES_TEXTOS = "textos_reglages";
export const REGLAGES_TEXTOS_DEFAUT = { envoiDirect: true, vehiculePret: true, rappelRdv: true, heureRappel: 16, reponses: true };
export const HEURES_RAPPEL = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
export const TYPES_SORTANTS = ["MESSAGE", "VEHICULE_PRET", "RAPPEL_RDV", "LIEN", "RAPPEL", "ESSAI"];
const LONGUEUR_MAX = 1000;
const FUSEAU = "America/Toronto";

export const twilioConfigure = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_NUMERO || process.env.TWILIO_MESSAGING_SERVICE_SID));

// Module actif et Twilio configuré
export async function textosActifs() {
  return twilioConfigure() && (await lireParametre(CLE_MODULE_TEXTOS)) === "actif";
}

export async function lireReglagesTextos() {
  let lus = {};
  try {
    lus = JSON.parse((await lireParametre(CLE_REGLAGES_TEXTOS)) || "{}") || {};
  } catch {}
  return normaliserReglages(lus);
}

export function normaliserReglages(r = {}) {
  const d = REGLAGES_TEXTOS_DEFAUT;
  const booleen = (v, defaut) => (typeof v === "boolean" ? v : defaut);
  const heure = Number(r.heureRappel);
  return {
    envoiDirect: booleen(r.envoiDirect, d.envoiDirect),
    vehiculePret: booleen(r.vehiculePret, d.vehiculePret),
    rappelRdv: booleen(r.rappelRdv, d.rappelRdv),
    heureRappel: HEURES_RAPPEL.includes(heure) ? heure : d.heureRappel,
    reponses: booleen(r.reponses, d.reponses),
  };
}

// Les boutons « 💬 Texto » envoient-ils depuis l'appli ?
export async function envoiDirectActif() {
  return (await textosActifs()) && (await lireReglagesTextos()).envoiDirect;
}

export const numeroEnvoi = () => process.env.TWILIO_NUMERO || "";

function adressePublique() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export class ErreurTexto extends Error {
  constructor(message, statut = 400) {
    super(message);
    this.statut = statut;
  }
}

// ---------- Twilio ----------

// Erreurs de Twilio les plus probables, en clair
const ERREURS_TWILIO = {
  20003: "Twilio refuse les clés de l'installation (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN).",
  21211: "Ce numéro n'est pas valide.",
  21212: "Le numéro d'envoi (TWILIO_NUMERO) n'est pas valide.",
  21408: "Twilio n'envoie pas de textos vers cette région (Twilio → Messaging → Settings → Geo permissions).",
  21606: "Le numéro d'envoi (TWILIO_NUMERO) ne peut pas envoyer de textos.",
  21610: "Ce numéro a répondu STOP : Twilio ne lui envoie plus de textos. Il peut répondre START pour les recevoir de nouveau.",
  21612: "Twilio ne peut pas joindre ce numéro par texto.",
  21614: "Ce numéro ne peut pas recevoir de textos (ligne fixe ?).",
  30003: "Le téléphone du client est éteint ou hors réseau.",
  30004: "Le client bloque les textos de ce numéro.",
  30005: "Ce numéro n'existe pas ou n'est plus en service.",
  30006: "Ce numéro ne peut pas recevoir de textos (ligne fixe ?).",
  30007: "L'opérateur du client a filtré le texto.",
};
export const messageErreurTwilio = (code, message) =>
  ERREURS_TWILIO[Number(code)] || (message ? `Twilio a refusé le texto : ${message}` : `Twilio a refusé le texto (code ${code}).`);

async function appelTwilio(chemin, parametres) {
  const base = (process.env.TWILIO_API_URL || "https://api.twilio.com").replace(/\/+$/, "");
  const compte = process.env.TWILIO_ACCOUNT_SID;
  let res;
  try {
    res = await fetch(`${base}/2010-04-01/Accounts/${encodeURIComponent(compte)}/${chemin}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${compte}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(parametres),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw Object.assign(new Error("Twilio ne répond pas. Réessaie dans un moment."), { code: null });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(messageErreurTwilio(data.code, data.message)), { code: data.code });
  return data;
}

// Signature d'un avis de Twilio (X-Twilio-Signature) : HMAC-SHA1, avec le
// jeton du compte, de l'adresse complète suivie des paramètres triés
export function signatureTwilioValide(url, parametres, signature, jeton = process.env.TWILIO_AUTH_TOKEN) {
  if (!signature || !jeton || !url) return false;
  const donnees = url + Object.keys(parametres).sort().map((k) => k + parametres[k]).join("");
  const attendue = crypto.createHmac("sha1", jeton).update(Buffer.from(donnees, "utf-8")).digest("base64");
  const a = Buffer.from(attendue);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Adresses sous lesquelles Twilio a pu appeler cette route (derrière le
// relais de Railway, l'adresse vue par le serveur n'est pas la publique)
export function adressesAvis(request) {
  const { pathname, search } = new URL(request.url);
  const chemin = `${pathname}${search}`;
  const hote = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocole = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  return [...new Set([
    process.env.APP_URL && `${adressePublique()}${chemin}`,
    hote && `${protocole}://${hote}${chemin}`,
    request.url,
  ].filter(Boolean))];
}

// ---------- Clients ----------

// Client dont le numéro de téléphone est celui-ci (le plus récent s'il y en
// a plusieurs). Les numéros sont écrits à la main : comparés chiffres seulement.
export async function clientParNumero(numero) {
  const chiffres = String(numero || "").replace(/\D/g, "").slice(-10);
  if (chiffres.length < 7) return null;
  const lignes = await prisma.$queryRaw`
    SELECT id, nom, telephone FROM "Client"
    WHERE telephone IS NOT NULL AND regexp_replace(telephone, '[^0-9]', '', 'g') LIKE ${`%${chiffres}`}
    ORDER BY "creeLe" DESC LIMIT 10`;
  return lignes.find((c) => numeroE164(c.telephone) === numero) || null;
}

export async function numeroRefuse(numero) {
  return !!(await prisma.refusTextos.findUnique({ where: { telephone: numero } }));
}

// ---------- Envoi ----------

// Envoie un texto au client et le garde au journal. Lance une ErreurTexto
// (message en clair) si le texto ne peut pas partir ; un refus de Twilio est
// gardé au journal comme échec.
export async function envoyerTexto({ telephone, corps, type = "MESSAGE", clientId = null, bonId = null, rendezVousId = null, employe = null }) {
  if (!(await textosActifs())) throw new ErreurTexto("Les textos automatiques ne sont pas actifs.", 409);
  const numero = numeroE164(telephone);
  if (!numero) throw new ErreurTexto("Ce numéro ne peut pas recevoir de texto.");
  const texte = String(corps || "").trim();
  if (!texte) throw new ErreurTexto("Le texto est vide.");
  if (texte.length > LONGUEUR_MAX) throw new ErreurTexto(`Le texto est trop long (${LONGUEUR_MAX} caractères au plus).`);
  if (!TYPES_SORTANTS.includes(type)) type = "MESSAGE";
  if (await numeroRefuse(numero)) {
    throw new ErreurTexto("Ce client a répondu ARRET : il ne reçoit plus nos textos. Il peut répondre RETOUR pour les recevoir de nouveau.", 409);
  }
  const corpsFinal = TYPES_AVEC_MENTION.includes(type) && !texte.includes("ARRET") ? `${texte}\n${MENTION_ARRET}` : texte;
  const idClient = clientId || (await clientParNumero(numero))?.id || null;
  const journal = {
    direction: "SORTANT", telephone: numero, corps: corpsFinal, type, clientId: idClient, bonId, rendezVousId,
    employeId: employe?.id || null, employeNom: employe?.nom || null,
  };

  const parametres = { To: numero, Body: corpsFinal };
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) parametres.MessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  else parametres.From = numeroEnvoi();
  if (process.env.APP_URL) parametres.StatusCallback = `${adressePublique()}/api/twilio/statut`;

  let resultat;
  try {
    resultat = await appelTwilio("Messages.json", parametres);
  } catch (e) {
    if (Number(e.code) === 21610) await marquerRefus(numero, "STOP");
    await prisma.texto.create({ data: { ...journal, statut: "ECHEC", erreur: e.message } });
    throw new ErreurTexto(e.message, 502);
  }
  return prisma.texto.create({ data: { ...journal, statut: resultat.status === "failed" ? "ECHEC" : "ENVOYE", sid: resultat.sid || null } });
}

async function marquerRefus(numero, motCle) {
  await prisma.refusTextos.upsert({ where: { telephone: numero }, update: { motCle }, create: { telephone: numero, motCle } });
}

// ---------- Envois automatiques ----------

// Texto « véhicule prêt » à la facturation du bon (une seule fois par bon).
// Pas pour une facture comptoir ni un bon interne. Ne lance jamais.
export async function texterVehiculePret(bonId) {
  try {
    if (!(await textosActifs()) || !(await lireReglagesTextos()).vehiculePret) return null;
    const bon = await prisma.bonTravail.findUnique({
      where: { id: bonId },
      include: { client: { select: { id: true, nom: true, telephone: true } }, vehicule: true, facture: true },
    });
    if (!bon?.facture || bon.comptoir || bon.vehiculeVenteId) return null;
    const numero = numeroE164(bon.client?.telephone);
    if (!numero || (await numeroRefuse(numero))) return null;
    if (await prisma.texto.findFirst({ where: { bonId, type: "VEHICULE_PRET", statut: { not: "ECHEC" } }, select: { id: true } })) return null;

    const { nomEntreprise } = await obtenirInfosEntreprise();
    // Solde à payer (après les dépôts appliqués) : lien de paiement en ligne
    const facture = await prisma.facture.findUnique({ where: { id: bon.facture.id } });
    const lienPaiement = facture && soldeFacture(facture) > 0.005 && (await paiementEnLigneActif()) ? await assurerLienPaiement(facture.id) : null;
    const corps = MESSAGES_TEXTO.vehiculePret({ nom: nomClientBon(bon), vehicule: bon.vehicule ? libelleVehicule(bon.vehicule) : "", lienPaiement, nomEntreprise });
    const texto = await envoyerTexto({ telephone: numero, corps, type: "VEHICULE_PRET", clientId: bon.clientId, bonId });
    await prisma.bonTravail.update({ where: { id: bonId }, data: { avisPretLe: new Date(), avisPretA: `texto au ${numeroLisible(numero)}` } });
    return texto;
  } catch (e) {
    console.error("Texto « véhicule prêt » non envoyé :", e.message);
    return null;
  }
}

const heureQuebec = (date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: FUSEAU, hour: "numeric", hourCycle: "h23" }).format(date));
function lendemain(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Rappels de rendez-vous : la veille, dès l'heure choisie (et avant 21 h),
// un texto par rendez-vous confirmé du lendemain. Appelé chaque heure par
// lib/planificateurSauvegarde.js.
export async function verifierRappelsRendezVous(maintenant = new Date()) {
  if (!(await textosActifs())) return { envoyes: 0 };
  const reglages = await lireReglagesTextos();
  const heure = heureQuebec(maintenant);
  if (!reglages.rappelRdv || heure < reglages.heureRappel || heure >= 21) return { envoyes: 0 };

  const { debut, fin } = limitesJourQuebec(lendemain(dateAujourdhuiQuebec()));
  const rendezVous = await prisma.rendezVous.findMany({
    where: { statut: "CONFIRME", date: { gte: debut, lte: fin } },
    include: { client: { select: { nom: true, telephone: true } } },
    orderBy: { date: "asc" },
  });
  if (rendezVous.length === 0) return { envoyes: 0 };
  const dejaFaits = new Set((await prisma.texto.findMany({
    where: { type: "RAPPEL_RDV", rendezVousId: { in: rendezVous.map((r) => r.id) } },
    select: { rendezVousId: true },
  })).map((t) => t.rendezVousId));

  const { nomEntreprise } = await obtenirInfosEntreprise();
  let envoyes = 0;
  for (const rdv of rendezVous) {
    if (dejaFaits.has(rdv.id)) continue; // un essai par rendez-vous, même raté
    const numero = numeroE164(rdv.clientTelephone || rdv.client?.telephone);
    if (!numero || (await numeroRefuse(numero))) continue;
    try {
      await envoyerTexto({
        telephone: numero, type: "RAPPEL_RDV", clientId: rdv.clientId, rendezVousId: rdv.id,
        corps: MESSAGES_TEXTO.rappelRendezVous({ nom: rdv.clientNom || rdv.client?.nom, quand: quandRendezVous(rdv.date), nomEntreprise }),
      });
      envoyes += 1;
    } catch (e) {
      console.error(`Rappel de rendez-vous non envoyé (${rdv.id}) :`, e.message);
    }
  }
  if (envoyes > 0) console.log(`Rappels de rendez-vous : ${envoyes} texto(s) envoyé(s).`);
  return { envoyes };
}

// ---------- Réception ----------

const sansAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const motCle = (corps) => sansAccents(String(corps || "")).toUpperCase().replace(/[^A-Z]/g, "");
// Twilio gère lui-même STOP, START… (il répond en anglais) ; ARRET et RETOUR
// sont les nôtres, avec une réponse en français
const MOTS_ARRET_TWILIO = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const MOTS_ARRET = ["ARRET", "ARRETER", "DESABONNER"];
const MOTS_RETOUR_TWILIO = ["START", "UNSTOP", "YES"];
const MOTS_RETOUR = ["RETOUR", "ABONNER"];

// Texto reçu d'un client (avis de Twilio) → le texte de la réponse à lui
// renvoyer, ou null
export async function recevoirTexto(parametres) {
  const numero = numeroE164(parametres.From);
  const corps = String(parametres.Body || "").trim();
  const nbMedias = Number(parametres.NumMedia || 0);
  if (!numero) return null;
  const { nomEntreprise, telephone: telephoneEntreprise } = await obtenirInfosEntreprise();
  const mot = motCle(corps);
  const sid = parametres.MessageSid || parametres.SmsSid || null;
  if (sid && (await prisma.texto.findUnique({ where: { sid }, select: { id: true } }))) return null; // avis répété

  // Dernier texto envoyé à ce numéro : client, bon et rendez-vous de la conversation
  const dernier = await prisma.texto.findFirst({ where: { telephone: numero, direction: "SORTANT" }, orderBy: { creeLe: "desc" } });
  const client = dernier?.clientId
    ? await prisma.client.findUnique({ where: { id: dernier.clientId }, select: { id: true, nom: true } })
    : await clientParNumero(numero);
  const recent = dernier && Date.now() - dernier.creeLe.getTime() < 14 * 24 * 3600 * 1000;
  const texte = corps + (nbMedias > 0 ? `${corps ? "\n" : ""}📎 ${nbMedias} pièce${nbMedias > 1 ? "s" : ""} jointe${nbMedias > 1 ? "s" : ""} (à voir dans Twilio)` : "");
  const entrant = {
    direction: "ENTRANT", telephone: numero, corps: texte || "(vide)", type: "REPONSE", statut: "RECU", sid,
    clientId: client?.id || null, bonId: recent ? dernier.bonId : null, rendezVousId: recent ? dernier.rendezVousId : null,
  };

  // Désabonnement et retour
  const arret = MOTS_ARRET.includes(mot) || MOTS_ARRET_TWILIO.includes(mot);
  const retour = MOTS_RETOUR.includes(mot) || (MOTS_RETOUR_TWILIO.includes(mot) && (await numeroRefuse(numero)));
  if (arret || retour) {
    if (arret) await marquerRefus(numero, mot);
    else await prisma.refusTextos.deleteMany({ where: { telephone: numero } });
    await prisma.texto.create({ data: { ...entrant, lu: true } });
    if (MOTS_ARRET.includes(mot)) return MESSAGES_TEXTO.arret({ nomEntreprise });
    if (MOTS_RETOUR.includes(mot)) return MESSAGES_TEXTO.retour({ nomEntreprise });
    return null; // Twilio répond lui-même
  }

  const reglages = await lireReglagesTextos();
  if (!reglages.reponses) {
    // Une réponse automatique par jour au plus (pas de ping-pong avec un robot)
    const depuis = new Date(Date.now() - 24 * 3600 * 1000);
    const dejaRepondu = await prisma.texto.findFirst({ where: { telephone: numero, type: "AUTO_REPONSE", creeLe: { gte: depuis } }, select: { id: true } });
    if (dejaRepondu) return null;
    const reponse = MESSAGES_TEXTO.reponsesFermees({ telephone: telephoneEntreprise, nomEntreprise });
    await prisma.texto.create({ data: { direction: "SORTANT", telephone: numero, corps: reponse, type: "AUTO_REPONSE", statut: "ENVOYE", clientId: client?.id || null } });
    return reponse;
  }

  await prisma.texto.create({ data: { ...entrant, lu: false } });
  const de = client?.nom || numeroLisible(numero);
  await notifier("TEXTO_RECU", {
    titre: `💬 Texto de ${de}`,
    corps: texte,
    url: `/textos?numero=${encodeURIComponent(numero)}`,
    tag: `texto-${numero}`,
  });
  return null;
}

// Avis d'état d'un texto envoyé (livré, échoué…)
export async function majStatutTexto(parametres) {
  const sid = parametres.MessageSid || parametres.SmsSid;
  if (!sid) return;
  const etat = String(parametres.MessageStatus || parametres.SmsStatus || "");
  const statut = etat === "delivered" ? "LIVRE" : etat === "failed" || etat === "undelivered" ? "ECHEC" : null;
  if (!statut) return;
  const code = parametres.ErrorCode ? Number(parametres.ErrorCode) : null;
  const texto = await prisma.texto.findUnique({ where: { sid }, select: { id: true, telephone: true, statut: true } });
  if (!texto || texto.statut === statut) return;
  await prisma.texto.update({ where: { id: texto.id }, data: { statut, erreur: statut === "ECHEC" ? messageErreurTwilio(code, null) : null } });
  if (code === 21610) await marquerRefus(texto.telephone, "STOP");
}

// ---------- Conversations ----------

// Conversations (une par numéro), la plus récente en premier
export async function listerConversations({ recherche = "", limite = 60 } = {}) {
  const lignes = await prisma.$queryRaw`
    SELECT DISTINCT ON (telephone) telephone, id, corps, direction, "creeLe", "clientId", statut
    FROM "Texto" ORDER BY telephone, "creeLe" DESC`;
  const nonLus = await prisma.texto.groupBy({ by: ["telephone"], where: { direction: "ENTRANT", lu: false }, _count: { _all: true } });
  const parNumero = Object.fromEntries(nonLus.map((n) => [n.telephone, n._count._all]));
  // Client de la conversation : celui du dernier texto qui en a un
  const avecClient = await prisma.$queryRaw`
    SELECT DISTINCT ON (telephone) telephone, "clientId" FROM "Texto"
    WHERE "clientId" IS NOT NULL ORDER BY telephone, "creeLe" DESC`;
  const clientIds = Object.fromEntries(avecClient.map((l) => [l.telephone, l.clientId]));
  const clients = await prisma.client.findMany({ where: { id: { in: [...new Set(Object.values(clientIds))] } }, select: { id: true, nom: true } });
  const nomClient = Object.fromEntries(clients.map((c) => [c.id, c.nom]));
  const filtre = sansAccents(recherche.trim().toLowerCase());
  const chiffres = recherche.replace(/\D/g, "");
  return lignes
    .map((l) => ({
      telephone: l.telephone, dernier: { corps: l.corps, direction: l.direction, creeLe: l.creeLe, statut: l.statut },
      clientId: clientIds[l.telephone] || null, clientNom: nomClient[clientIds[l.telephone]] || null, nonLus: parNumero[l.telephone] || 0,
    }))
    .filter((c) => !filtre || sansAccents((c.clientNom || "").toLowerCase()).includes(filtre) || (chiffres.length >= 3 && c.telephone.includes(chiffres)))
    .sort((a, b) => b.dernier.creeLe - a.dernier.creeLe)
    .slice(0, limite);
}

export async function nbTextosNonLus() {
  return prisma.texto.count({ where: { direction: "ENTRANT", lu: false } });
}
