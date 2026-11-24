// Hausses de loyer d'un immeuble selon la méthode du TAL (calculs :
// haussesImmeuble, lib/immobilierCalculs.js) — page
// /immobilier/immeubles/<id>/hausses.
//
// Le calcul se refait ici, côté serveur, avec les loyers de la base : le
// nouveau loyer inscrit au bail et le PDF du calcul rangé dans ses documents
// ne dépendent jamais de chiffres envoyés tout faits par le navigateur.

import { prisma } from "./prisma";
import { genererDocumentBail, CALCUL_INTERNE } from "./immobilier";
import { haussesImmeuble, POURCENTAGES_BASE_TAL } from "./immobilierCalculs";

const CLE_POURCENTAGES = "immo_pourcentages_tal"; // JSON { "2027": 2.8 } : taux pas encore publiés ici

export const SELECT_IMMEUBLE_HAUSSES = {
  id: true, nom: true, adresse: true, ville: true,
  logements: {
    select: {
      id: true, numero: true, type: true, loyerVise: true,
      baux: {
        where: { statut: "ACTIF" },
        select: { id: true, statut: true, dateDebut: true, dateFin: true, loyer: true, nouveauLoyer: true, avisEnvoyeLe: true, reponseAvis: true, locataires: { select: { id: true, nom: true } } },
      },
    },
  },
};

// Logements dans l'ordre des numéros ; retourne l'immeuble (ou null)
function trierLogements(immeuble) {
  immeuble?.logements.sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }));
  return immeuble;
}

export async function lirePourcentagesInscrits() {
  const p = await prisma.parametre.findUnique({ where: { cle: CLE_POURCENTAGES } });
  try { return p?.valeur ? JSON.parse(p.valeur) : {}; } catch { return {}; }
}

// Inscrit le pourcentage de base d'une période que l'appli ne connaît pas
// encore (le TAL le publie vers la mi-janvier). taux vide : le retire.
export async function inscrirePourcentage(periode, taux) {
  const p = Math.round(Number(periode));
  if (!(p >= 2026 && p <= 2100)) return { erreur: "Période invalide." };
  if (POURCENTAGES_BASE_TAL[p] != null) return { erreur: `Le TAL a déjà publié le pourcentage de cette période : ${String(POURCENTAGES_BASE_TAL[p]).replace(".", ",")} %.` };
  const inscrits = await lirePourcentagesInscrits();
  if (taux === "" || taux == null) delete inscrits[p];
  else {
    const t = Number(String(taux).replace(",", "."));
    if (!(t > 0 && t <= 15)) return { erreur: "Le pourcentage doit être entre 0 et 15 %." };
    inscrits[p] = Math.round(t * 100) / 100;
  }
  const valeur = JSON.stringify(inscrits);
  await prisma.parametre.upsert({ where: { cle: CLE_POURCENTAGES }, update: { valeur }, create: { cle: CLE_POURCENTAGES, valeur } });
  return { inscrits };
}

// Ce qui préremplit le calculateur : taxes et assurances de l'immeuble par
// année (tirées des dépenses inscrites) et travaux terminés des deux
// dernières années, à cocher s'ils sont des dépenses d'immobilisation
export async function donneesHausses(immeubleId) {
  const [immeuble, depenses, reparations, inscrits] = await Promise.all([
    prisma.immeubleImmo.findUnique({ where: { id: immeubleId }, select: SELECT_IMMEUBLE_HAUSSES }),
    prisma.depenseImmo.findMany({ where: { immeubleId, categorie: { in: ["TAXES_MUNICIPALES", "TAXES_SCOLAIRES", "ASSURANCE"] } }, select: { date: true, montant: true, categorie: true } }),
    prisma.reparationImmo.findMany({
      where: { immeubleId, statut: "TERMINEE", coutReel: { gt: 0 }, OR: [{ dateFin: { gte: new Date(Date.now() - 2 * 366 * 86400000) } }, { dateFin: null, creeLe: { gte: new Date(Date.now() - 2 * 366 * 86400000) } }] },
      select: { id: true, numero: true, titre: true, categorie: true, coutReel: true, dateFin: true, creeLe: true, logementId: true },
      orderBy: [{ dateFin: "desc" }],
    }),
    lirePourcentagesInscrits(),
  ]);
  if (!immeuble) return null;
  trierLogements(immeuble);
  const parAnnee = { taxes: {}, assurances: {} };
  for (const d of depenses) {
    const a = d.date.getUTCFullYear();
    const cle = d.categorie === "ASSURANCE" ? "assurances" : "taxes";
    parAnnee[cle][a] = Math.round(((parAnnee[cle][a] || 0) + d.montant) * 100) / 100;
  }
  return { immeuble, parAnnee, reparations, inscrits };
}

const nombre = (v) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

// Entrées reçues du calculateur → { entrees } ou { erreur }
export function lireEntrees(body, immeuble) {
  const logements = new Set(immeuble.logements.map((l) => l.id));
  const paire = (x) => ({ avant: nombre(x?.avant), apres: nombre(x?.apres) });
  const travaux = [];
  for (const t of Array.isArray(body.travaux) ? body.travaux.slice(0, 50) : []) {
    const montant = nombre(t.montant);
    if (!montant) continue;
    if (t.logementId && !logements.has(t.logementId)) return { erreur: "Logement des travaux introuvable dans cet immeuble." };
    travaux.push({ description: String(t.description || "Travaux").slice(0, 160), montant, aide: Math.min(nombre(t.aide) || 0, montant), logementId: t.logementId || null });
  }
  const taux = {};
  for (const [p, t] of Object.entries(body.taux || {})) {
    const n = nombre(t);
    if (/^\d{4}$/.test(p) && n > 0 && n <= 15) taux[p] = n;
  }
  const annee = Math.round(Number(body.annee)) || new Date().getUTCFullYear();
  return { entrees: { annee, taux, taxes: paire(body.taxes), assurances: paire(body.assurances), travaux } };
}

// Inscrit le nouveau loyer proposé aux baux choisis (bailIds) et, si pdf,
// range le détail du calcul dans les documents de chaque bail. Un bail dont
// l'avis est déjà envoyé n'est pas touché. → { appliques: [{ bailId, nouveauLoyer, documentId }], ignores: [...] }
export async function appliquerHausses(immeubleId, body, creePar) {
  const immeuble = trierLogements(await prisma.immeubleImmo.findUnique({ where: { id: immeubleId }, select: SELECT_IMMEUBLE_HAUSSES }));
  if (!immeuble) return { erreur: "Immeuble introuvable." };
  const r = lireEntrees(body, immeuble);
  if (r.erreur) return r;
  const inscrits = await lirePourcentagesInscrits();
  const entrees = { ...r.entrees, taux: { ...inscrits, ...r.entrees.taux } };
  const choisis = new Set(Array.isArray(body.bailIds) ? body.bailIds : []);
  const lignes = haussesImmeuble(immeuble, entrees).filter((l) => choisis.has(l.bail.id));
  if (lignes.length === 0) return { erreur: "Choisis au moins un bail." };
  const appliques = [];
  const ignores = [];
  for (const l of lignes) {
    const qui = `${l.logement.numero} (${l.bail.locataires.map((x) => x.nom).join(", ")})`;
    if (l.bail.avisEnvoyeLe) { ignores.push(`${qui} : avis déjà envoyé`); continue; }
    if (!l.calcul) { ignores.push(`${qui} : pourcentage de base de la période ${l.periode} inconnu`); continue; }
    await prisma.bailImmo.update({ where: { id: l.bail.id }, data: { nouveauLoyer: l.calcul.nouveauLoyer } });
    let documentId = null;
    if (body.pdf) {
      const doc = await genererDocumentBail(l.bail.id, "CALCUL_HAUSSE", {
        [CALCUL_INTERNE]: true,
        calcul: l.calcul, debut: l.debut, periode: l.periode, taux: l.taux, part: l.part, annee: entrees.annee,
        taxes: entrees.taxes, assurances: entrees.assurances, travaux: entrees.travaux, logementId: l.logement.id,
        logements: Object.fromEntries(immeuble.logements.map((x) => [x.id, x.numero])), immeuble: immeuble.nom,
      }, creePar);
      if (doc.erreur) ignores.push(`${qui} : ${doc.erreur}`);
      else documentId = doc.id;
    }
    appliques.push({ bailId: l.bail.id, nouveauLoyer: l.calcul.nouveauLoyer, documentId });
  }
  return { appliques, ignores };
}
