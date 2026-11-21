// Inspection numérique, d'une visite à l'autre (lib/inspections.js) : le
// module est-il actif, les points notés à surveiller qui restent à revoir, et
// ce que la dernière inspection d'un véhicule avait noté point par point.
// Sans dépendance aux sessions ni aux routes : servi aussi aux rappels
// d'entretien (lib/rappelsEntretien.js), envoyés en tâche de fond.
import { prisma } from "./prisma";
import { lireParametre } from "./parametres";
import { estARecommander } from "./grillesInspection";

// Module Inspection numérique (Administrateur → Modules), actif par défaut
export const CLE_MODULE_INSPECTION = "module_inspection";

export async function inspectionActive() {
  return (await lireParametre(CLE_MODULE_INSPECTION)) !== "inactif";
}

// Inspections terminées d'au plus deux ans : au-delà, le point a sûrement
// changé ou le client est parti
const FENETRE_RAPPEL_MS = 2 * 365 * 24 * 3600 * 1000;

// Points à revoir à la prochaine visite de ces véhicules → Map(vehiculeId →
// [points]) : ce qui était à surveiller, ou urgent mais pas fait, à la
// dernière inspection qui a vérifié ce point. Un point vérifié de nouveau
// depuis (même nom) se règle avec la nouvelle inspection ; un point devenu
// une tâche, ou écarté par le comptoir, ne revient plus. saufBonId : les
// inspections de ce bon (la visite en cours) règlent leurs points mais n'en
// proposent pas — ils sont déjà dans sa propre inspection.
export async function pointsARevoir(vehiculeIds, { saufBonId = null } = {}) {
  const resultat = new Map();
  if (!vehiculeIds.length) return resultat;
  const inspections = await prisma.inspection.findMany({
    where: { statut: "TERMINEE", bon: { vehiculeId: { in: vehiculeIds } }, creeLe: { gte: new Date(Date.now() - FENETRE_RAPPEL_MS) } },
    orderBy: { creeLe: "desc" },
    select: {
      id: true, bonId: true, creeLe: true, termineeLe: true, reponseLe: true,
      bon: { select: { vehiculeId: true, numero: true } },
      points: {
        orderBy: { ordre: "asc" },
        select: {
          id: true, section: true, libelle: true, unite: true, etat: true, mesure: true, constat: true,
          recommandation: true, prixEstime: true, approbation: true, problemeId: true, rappelEcarteLe: true,
        },
      },
    },
  });
  const vus = new Map(); // vehiculeId → noms des points déjà réglés par une inspection plus récente
  for (const inspection of inspections) {
    const vehiculeId = inspection.bon.vehiculeId;
    if (!vus.has(vehiculeId)) vus.set(vehiculeId, new Set());
    for (const pt of inspection.points) {
      const nom = pt.libelle.toLowerCase();
      if (vus.get(vehiculeId).has(nom)) continue;
      vus.get(vehiculeId).add(nom);
      if (inspection.bonId === saufBonId || !estARecommander(pt) || pt.problemeId || pt.rappelEcarteLe) continue;
      if (!resultat.has(vehiculeId)) resultat.set(vehiculeId, []);
      resultat.get(vehiculeId).push({
        ...pt,
        inspectionId: inspection.id, bonId: inspection.bonId, bonNumero: inspection.bon.numero,
        date: inspection.termineeLe || inspection.creeLe, reponseLe: inspection.reponseLe,
      });
    }
  }
  return resultat;
}

// Ce que la dernière inspection terminée de ce véhicule (avant celle-ci)
// avait noté pour chaque point : { nom du point en minuscules → { etat,
// mesure, unite, date } }, seulement pour les points mesurés ou pas OK — de
// quoi comparer l'usure d'une visite à l'autre
export async function historiquePoints(vehiculeId, { inspectionId, avant }) {
  if (!vehiculeId) return {};
  const inspections = await prisma.inspection.findMany({
    where: { statut: "TERMINEE", id: { not: inspectionId }, bon: { vehiculeId }, creeLe: { lt: avant, gte: new Date(Date.now() - FENETRE_RAPPEL_MS) } },
    orderBy: { creeLe: "desc" },
    select: { creeLe: true, termineeLe: true, points: { select: { libelle: true, etat: true, mesure: true, unite: true } } },
  });
  const historique = {};
  for (const inspection of inspections) {
    for (const pt of inspection.points) {
      const nom = pt.libelle.toLowerCase();
      if (nom in historique) continue;
      historique[nom] = pt.mesure || (pt.etat && pt.etat !== "OK" && pt.etat !== "NA")
        ? { etat: pt.etat, mesure: pt.mesure, unite: pt.unite, date: inspection.termineeLe || inspection.creeLe }
        : null; // vérifié OK sans mesure : rien à rappeler, mais il règle les plus anciens
    }
  }
  return Object.fromEntries(Object.entries(historique).filter(([, v]) => v));
}
