// Automatisations du module Immobilier — vérifiées chaque heure par
// lib/planificateurSauvegarde.js, faites une fois par jour (de 8 h à 18 h,
// heure du Québec), chacune activée à part dans Immobilier → Automatisations :
//
//   1. Loyers du mois : inscrits tout seuls à partir du 1er (une seule fois
//      par mois — un loyer retiré à la main n'est pas remis le lendemain).
//   2. Rappel de retard : le relevé de compte part par courriel aux
//      locataires d'un bail en cours dont un loyer est en retard depuis N
//      jours. Un seul rappel par loyer impayé (consigné dans les courriels
//      du bail, type RAPPEL) ; exige l'envoi de courriel configuré.
//   3. Avis au propriétaire (cloche et téléphone, type IMMO_A_SURVEILLER) :
//      période d'avis de modification ouverte et ses 15 derniers jours,
//      délai de réponse à l'avis passé, refus à porter au TAL, bail échu ou
//      à renouveler, retard de plus de trois semaines, assurance ou contrat
//      qui expire — chaque situation une seule fois — et le résumé de ce
//      que les automatisations ont fait.
//
// Réglages et suivi dans la table Parametre (aucune migration).

import { prisma } from "./prisma";
import { immobilierActif, genererLoyers, comptesDesBaux } from "./immobilier";
import { envoyerReleve, courrielConfigure } from "./immobilierCourriel";
import { notifier, notificationsActives } from "./notifications";
import { aSurveillerBail, aSurveillerEntretien, etatExpiration, periodeCourante, periodeLisible, argent, nomLogement, nomsLocataires, trouver, CATEGORIES_DOCUMENTS } from "./immobilierCalculs";

const CLE_REGLAGES = "immo_automatisations"; // JSON, voir REGLAGES_DEFAUT
const CLE_DERNIER_JOUR = "immo_auto_dernier_jour"; // « 2026-11-24 » : vérification du jour faite
const CLE_MOIS_LOYERS = "immo_auto_loyers_mois"; // « 2026-12 » : loyers de ce mois déjà inscrits tout seuls
const CLE_AVISES = "immo_auto_avises"; // situations déjà annoncées au propriétaire, séparées par des virgules
const CLE_RESULTAT = "immo_auto_dernier_resultat"; // JSON { le, lignes } : affiché dans Automatisations

export const REGLAGES_DEFAUT = { loyersAuto: false, rappelRetard: false, joursRappel: 5, avisProprio: true };
const ESSAIS_RAPPEL = 3; // un rappel refusé par le service de courriel est retenté au plus 3 fois
const AUTEUR = "Automatisation";

const heureQuebec = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric", hourCycle: "h23" }).format(new Date()));
const jourQuebecTexte = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

async function lire(cle) {
  return (await prisma.parametre.findUnique({ where: { cle } }))?.valeur;
}
async function ecrire(cle, valeur) {
  await prisma.parametre.upsert({ where: { cle }, update: { valeur }, create: { cle, valeur } });
}
const nBaux = (n) => `${n} ${n > 1 ? "baux" : "bail"}`;

function json(texte, defaut) {
  try { return texte ? JSON.parse(texte) : defaut; } catch { return defaut; }
}

export async function lireReglagesImmoAuto() {
  const r = { ...REGLAGES_DEFAUT, ...json(await lire(CLE_REGLAGES), {}) };
  return { loyersAuto: r.loyersAuto === true, rappelRetard: r.rappelRetard === true, joursRappel: Number(r.joursRappel) || REGLAGES_DEFAUT.joursRappel, avisProprio: r.avisProprio !== false };
}

export async function enregistrerReglagesImmoAuto(entree) {
  const actuels = await lireReglagesImmoAuto();
  const r = { ...actuels };
  for (const k of ["loyersAuto", "rappelRetard", "avisProprio"]) if (entree[k] !== undefined) r[k] = entree[k] === true;
  if (entree.joursRappel !== undefined) {
    const n = Math.round(Number(entree.joursRappel));
    if (!(n >= 1 && n <= 60)) return { erreur: "Le rappel part de 1 à 60 jours après l'échéance." };
    r.joursRappel = n;
  }
  if (r.rappelRetard && !courrielConfigure()) return { erreur: "Le rappel par courriel exige l'envoi de courriel configuré (RESEND_API_KEY)." };
  await ecrire(CLE_REGLAGES, JSON.stringify(r));
  return { reglages: r };
}

export async function dernierResultatImmoAuto() {
  return json(await lire(CLE_RESULTAT), null);
}

// ---------- 1. Loyers du mois ----------

// journal : [{ texte, aviser }] — aviser : à mettre dans l'avis au propriétaire
async function inscrireLoyers(journal) {
  const periode = periodeCourante();
  if ((await lire(CLE_MOIS_LOYERS)) === periode) return;
  // Noté avant : un redémarrage en cours de route ne refait rien
  await ecrire(CLE_MOIS_LOYERS, periode);
  const r = await genererLoyers(periode, AUTEUR);
  if (r.erreur) return journal.push({ texte: `Loyers de ${periodeLisible(periode)} : ${r.erreur}`, aviser: true });
  journal.push(r.creees > 0
    ? { texte: `Loyers de ${periodeLisible(periode)} inscrits pour ${nBaux(r.creees)}`, aviser: true }
    : { texte: `Loyers de ${periodeLisible(periode)} : déjà inscrits`, aviser: false });
}

// ---------- 2. Rappels de retard ----------

async function envoyerRappels(reglages, comptes, journal) {
  if (!courrielConfigure()) return journal.push({ texte: "Rappels de retard : l'envoi de courriel n'est pas configuré", aviser: false });
  const dus = Object.entries(comptes).filter(([, c]) => c.enRetard > 0.005 && c.joursRetard >= reglages.joursRappel);
  let envoyes = 0;
  const sansCourriel = [];
  const echecs = [];
  for (const [bailId, c] of dus) {
    // Un rappel par loyer impayé : rien de plus depuis l'échéance du plus ancien
    const deja = await prisma.envoiImmo.findMany({ where: { bailId, type: "RAPPEL", date: { gte: new Date(c.depuis) } }, select: { erreur: true } });
    if (deja.some((e) => !e.erreur) || deja.length >= ESSAIS_RAPPEL) continue;
    const r = await envoyerReleve(bailId, AUTEUR, { rappel: true });
    if (r.erreur) { sansCourriel.push(bailId); continue; }
    if (r.envoyes > 0) envoyes += 1;
    if (r.echecs?.length) echecs.push(...r.echecs);
    await new Promise((ok) => setTimeout(ok, 600)); // limite de Resend : 2 envois par seconde
  }
  if (envoyes > 0) journal.push({ texte: `Rappel de retard envoyé par courriel pour ${nBaux(envoyes)}`, aviser: true });
  if (sansCourriel.length > 0) journal.push({ texte: `${nBaux(sansCourriel.length)} en retard sans courriel de locataire valide : à relancer autrement`, aviser: false });
  if (echecs.length > 0) journal.push({ texte: `${echecs.length} rappel${echecs.length > 1 ? "s" : ""} refusé${echecs.length > 1 ? "s" : ""} par le service de courriel`, aviser: true });
}

// ---------- 3. Avis au propriétaire ----------

// Situations à annoncer : [{ cle, texte }]
async function situations(comptes) {
  const baux = await prisma.bailImmo.findMany({
    where: { statut: "ACTIF" },
    select: {
      id: true, statut: true, dateDebut: true, dateFin: true, loyer: true, nouveauLoyer: true, avisEnvoyeLe: true, reponseAvis: true, reponseAvisLe: true,
      logement: { select: { numero: true, type: true, immeuble: { select: { nom: true } } } }, locataires: { select: { nom: true } },
    },
  });
  const out = [];
  for (const b of baux) {
    for (const s of aSurveillerBail(b, comptes[b.id])) {
      if (s.aviser) out.push({ cle: s.cle, texte: `${s.quoi} — ${b.logement.immeuble.nom}, ${nomLogement(b.logement)} (${nomsLocataires(b)})` });
    }
  }
  // Entretiens préventifs en retard ou dans les 14 prochains jours
  const entretiens = await prisma.entretienImmo.findMany({
    where: { actif: true, prochaineDate: { lte: new Date(Date.now() + 15 * 86400000) } },
    select: { id: true, titre: true, prochaineDate: true, frequenceMois: true, obligatoire: true, dansLogements: true, actif: true, immeuble: { select: { nom: true } } },
  });
  for (const e of entretiens) {
    const s = aSurveillerEntretien(e);
    if (s) out.push({ cle: s.cle, texte: `${s.quoi} — ${e.immeuble.nom}` });
  }
  const documents = await prisma.documentImmo.findMany({ where: { expireLe: { not: null } }, select: { id: true, titre: true, categorie: true, expireLe: true } });
  for (const d of documents) {
    const e = etatExpiration(d.expireLe);
    if (e && e.code !== "OK") out.push({ cle: `doc:${d.id}:${e.code}:${d.expireLe.toISOString().slice(0, 10)}`, texte: `${trouver(CATEGORIES_DOCUMENTS, d.categorie)?.icone || "📄"} « ${d.titre} » : ${e.label.toLowerCase()}` });
  }
  return out;
}

async function aviserProprietaire(comptes, journal) {
  // Module Notifications coupé : rien n'est noté comme annoncé
  if (!(await notificationsActives())) {
    journal.push({ texte: "Avis au propriétaire : le module Notifications est désactivé (Administrateur → Modules)", aviser: false });
    return 0;
  }
  const actuelles = await situations(comptes);
  const deja = new Set(((await lire(CLE_AVISES)) || "").split(",").filter(Boolean));
  const nouvelles = actuelles.filter((s) => !deja.has(s.cle));
  // Seules les situations encore actuelles restent dans la liste : elle ne grossit pas
  await ecrire(CLE_AVISES, actuelles.map((s) => s.cle).join(","));
  const textes = [...journal.filter((j) => j.aviser).map((j) => j.texte), ...nouvelles.map((s) => s.texte)];
  if (textes.length === 0) return 0;
  await notifier("IMMO_A_SURVEILLER", {
    titre: nouvelles.length === 0 ? "🏘️ Immobilier : automatisations du jour" : nouvelles.length === 1 ? "🏘️ Immobilier : une chose à surveiller" : `🏘️ Immobilier : ${nouvelles.length} choses à surveiller`,
    corps: textes.slice(0, 6).join(" · ") + (textes.length > 6 ? ` (+${textes.length - 6} autres)` : ""),
    url: "/immobilier",
    tag: "immobilier-auto",
  });
  return nouvelles.length;
}

// ---------- Vérification du jour ----------

// forcer : bouton « Vérifier maintenant » — sans égard à l'heure ni à la
// vérification déjà faite aujourd'hui (rien n'est fait deux fois pour autant)
export async function verifierAutomatisationsImmo({ forcer = false } = {}) {
  if (!(await immobilierActif())) return { lignes: [] };
  if (!forcer) {
    const heure = heureQuebec();
    if (heure < 8 || heure >= 18) return null;
    const aujourdhui = jourQuebecTexte();
    if ((await lire(CLE_DERNIER_JOUR)) === aujourdhui) return null;
    await ecrire(CLE_DERNIER_JOUR, aujourdhui);
  }
  const reglages = await lireReglagesImmoAuto();
  const journal = [];
  if (reglages.loyersAuto) await inscrireLoyers(journal);
  // Comptes lus après l'inscription des loyers
  const comptes = await comptesDesBaux({ bail: { statut: "ACTIF" } });
  if (reglages.rappelRetard) await envoyerRappels(reglages, comptes, journal);
  let avis = 0;
  if (reglages.avisProprio) avis = await aviserProprietaire(comptes, journal);
  const enRetard = Object.values(comptes).filter((c) => c.enRetard > 0.005);
  const resume = [
    ...journal.map((j) => j.texte),
    ...(reglages.avisProprio ? [avis > 0 ? `${avis} nouvelle${avis > 1 ? "s" : ""} situation${avis > 1 ? "s" : ""} annoncée${avis > 1 ? "s" : ""} au propriétaire` : "Aucune nouvelle situation à annoncer au propriétaire"] : []),
    enRetard.length > 0 ? `${nBaux(enRetard.length)} en retard, ${argent(enRetard.reduce((s, c) => s + c.enRetard, 0))} au total` : "Aucun loyer en retard",
  ];
  const resultat = { le: new Date().toISOString(), forcer, lignes: resume };
  await ecrire(CLE_RESULTAT, JSON.stringify(resultat));
  return resultat;
}
