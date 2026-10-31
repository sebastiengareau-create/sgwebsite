const { Prisma } = require("@prisma/client");
const { prisma } = require("./prisma");
const { normaliserVehicule, libelleVehicule } = require("./vehicules");
const { prochainNumeroClient } = require("./numerotation");
const { verserVehiculeAuDossier, kilometrageVehicule } = require("./clients");

// Véhicule d'une soumission, comme sur un bon : un véhicule du dossier du
// client (vehiculeId) ou un nouveau (vehicule). Le nouveau reste dans la
// soumission (vehiculeDetails) — il ne rejoint le dossier du client que si
// la soumission devient un bon, pour ne pas remplir le dossier d'estimés
// refusés. → { data } prêt pour Prisma, ou { erreur }.
async function lireVehiculeSoumission({ clientId, vehiculeId, vehicule }) {
  if (vehiculeId) {
    if (!clientId) return { erreur: "Un nouveau client n'a pas encore de véhicule au dossier." };
    const existant = await prisma.vehicule.findFirst({ where: { id: vehiculeId, clientId } });
    if (!existant) return { erreur: "Ce véhicule n'est pas au dossier de ce client." };
    return { data: { vehiculeId, vehiculeDetails: Prisma.DbNull, vehiculeInfo: libelleVehicule(existant) || null } };
  }
  const { data, vide, erreur } = normaliserVehicule(vehicule);
  if (erreur) return { erreur };
  return {
    data: {
      vehiculeId: null,
      vehiculeDetails: vide ? Prisma.DbNull : data,
      vehiculeInfo: vide ? null : libelleVehicule(data) || data.plaque || data.niv || null,
    },
  };
}

// Client et véhicule du bon qui naît d'une soumission (acceptée ou
// facturée) : le client lié, sinon un nouveau dossier ; le véhicule du
// dossier choisi (s'il y est toujours), sinon le nouveau, versé au dossier.
async function clientEtVehiculeDuBon(soumission) {
  let clientId = soumission.clientId;
  if (!clientId) {
    const client = await prisma.client.create({
      data: { numero: await prochainNumeroClient(), nom: soumission.clientNom, telephone: soumission.clientTelephone || null },
    });
    clientId = client.id;
  }
  const vehiculeId = soumission.vehicule?.clientId === clientId
    ? soumission.vehicule.id
    : await verserVehiculeAuDossier(clientId, soumission.vehiculeDetails);
  const kilometrage = await kilometrageVehicule(vehiculeId);
  return { clientId, vehiculeId, kilometrage };
}

// Montants d'une soumission, tels qu'entrés : heures estimées × taux horaire
// et pièces estimées (prix × qté). Même calcul que le total affiché dans la
// liste des soumissions.
function totauxSoumission(soumission, tauxHoraire) {
  const heures = soumission.taches.reduce((s, t) => s + (t.tempsEstime || 0), 0);
  const pieces = soumission.taches.reduce((s, t) => s + (t.pieces || []).reduce((s2, p) => s2 + p.prixEstime * p.qte, 0), 0);
  return { heures, mainOeuvre: heures * tauxHoraire, pieces };
}

// Quantité d'une pièce estimée, telle qu'entrée : 0 (ou vide) reste 0 — la
// facture d'une soumission reprend exactement ces quantités
function quantiteSoumission(v) {
  const n = Math.round(Number(String(v ?? "").replace(",", ".")));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Factures de soumissions sans écriture comptable : avant le correctif des
// quantités à 0, une tâche à 0 h comptait pour 1 h dans l'écriture, qui
// sortait déséquilibrée et n'était pas enregistrée. Repasse ces écritures
// (idempotent ; une période fermée est laissée telle quelle).
async function reparerEcrituresFacturesSoumissions(creePar) {
  const { posterFactureEmise } = require("./comptabilite");
  const soumissions = await prisma.soumission.findMany({ where: { statut: "FACTUREE", bonId: { not: null } }, select: { bonId: true } });
  if (soumissions.length === 0) return;
  const bons = await prisma.bonTravail.findMany({
    where: { id: { in: soumissions.map((s) => s.bonId) }, facture: { isNot: null } },
    include: { facture: true, problemes: { include: { pieces: { include: { piece: true } }, entreesTemps: true } } },
  });
  const dejaPostees = new Set((await prisma.ecritureComptable.findMany({
    where: { source: "FACTURE_EMISE", sourceId: { in: bons.map((b) => b.facture.id) } },
    select: { sourceId: true },
  })).map((e) => e.sourceId));
  for (const bon of bons) {
    if (dejaPostees.has(bon.facture.id) || bon.facture.statut === "ANNULEE") continue;
    try {
      await posterFactureEmise(bon, bon.facture, creePar);
    } catch (e) {
      if (!e.message.startsWith("PERIODE_LOCK:")) console.error(`Écriture de la facture ${bon.facture.numero} :`, e);
    }
  }
}

module.exports = { lireVehiculeSoumission, clientEtVehiculeDuBon, totauxSoumission, quantiteSoumission, reparerEcrituresFacturesSoumissions };
