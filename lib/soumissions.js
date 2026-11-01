const { Prisma } = require("@prisma/client");
const { prisma } = require("./prisma");
const { normaliserVehicule, libelleVehicule } = require("./vehicules");
const { prochainNumeroClient } = require("./numerotation");
const { verserVehiculeAuDossier, kilometrageVehicule } = require("./clients");
const { normaliserProvince, normaliserCodePostal } = require("./adresse");
const { sortirDuStockPourBon } = require("./bons");
const { sortirKitDuStockPourBon } = require("./kits");
const { CLIENT } = require("./client");

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

// Adresse du client sur une soumission, comme sur un bon : entrée pour un
// nouveau client (versée à son dossier si la soumission devient un bon) ;
// un client lié garde celle de son dossier.
function adresseClientSoumission(clientId, { clientAdresse, clientVille, clientProvince, clientCodePostal } = {}) {
  if (clientId) return { clientAdresse: null, clientVille: null, clientProvince: null, clientCodePostal: null };
  const adresse = {
    clientAdresse: String(clientAdresse || "").trim() || null,
    clientVille: String(clientVille || "").trim() || null,
    clientCodePostal: normaliserCodePostal(clientCodePostal),
  };
  // La province (présélectionnée) ne compte qu'avec le reste de l'adresse
  const rempli = Object.values(adresse).some(Boolean);
  return { ...adresse, clientProvince: rempli ? normaliserProvince(clientProvince) : null };
}

// Client et véhicule du bon qui naît d'une soumission (acceptée ou
// facturée) : le client lié, sinon un nouveau dossier ; le véhicule du
// dossier choisi (s'il y est toujours), sinon le nouveau, versé au dossier.
async function clientEtVehiculeDuBon(soumission) {
  let clientId = soumission.clientId;
  // Nom corrigé sur la soumission (différent du dossier) : il suit sur le bon
  // et sa facture, sans changer le dossier
  let clientNomAffiche = null;
  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { nom: true } });
    const nom = (soumission.clientNom || "").trim();
    if (client && nom && nom !== client.nom.trim()) clientNomAffiche = nom;
  }
  if (!clientId) {
    const client = await prisma.client.create({
      data: {
        numero: await prochainNumeroClient(),
        nom: soumission.clientNom,
        telephone: soumission.clientTelephone || null,
        adresse: soumission.clientAdresse || null,
        ville: soumission.clientVille || null,
        province: soumission.clientProvince || null,
        codePostal: soumission.clientCodePostal || null,
      },
    });
    clientId = client.id;
  }
  const vehiculeId = soumission.vehicule?.clientId === clientId
    ? soumission.vehicule.id
    : await verserVehiculeAuDossier(clientId, soumission.vehiculeDetails);
  const kilometrage = await kilometrageVehicule(vehiculeId);
  return { clientId, vehiculeId, kilometrage, clientNomAffiche };
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

// Tâches et pièces d'une soumission envoyées par le formulaire → données
// Prisma (create imbriqué). Une pièce peut venir de l'inventaire (pieceId) :
// elle y est seulement liée — rien ne sort du stock tant que la soumission
// n'est pas transférée en bon ou facturée. Un pieceId inconnu est ignoré
// (la ligne reste en texte libre).
async function tachesSoumissionPourPrisma(taches) {
  const ids = [...new Set(taches.flatMap((t) => (t.pieces || []).map((p) => p.pieceId)).filter(Boolean))];
  const existants = new Set(ids.length
    ? (await prisma.piece.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((p) => p.id)
    : []);
  return taches.map((t) => ({
    description: t.description,
    tempsEstime: Number(t.tempsEstime) || 0,
    pieces: {
      create: (t.pieces || []).map((p) => ({
        nom: p.nom,
        prixEstime: Number(p.prixEstime) || 0,
        qte: quantiteSoumission(p.qte),
        pieceId: existants.has(p.pieceId) ? p.pieceId : null,
      })),
    },
  }));
}

// Pièce estimée qui sortira du stock au transfert : liée à l'inventaire, et
// une quantité d'au moins 1 (une ligne à 0 reste une simple ligne d'estimé)
function sortDuStock(pieceEstimee) {
  return !!pieceEstimee.pieceId && pieceEstimee.qte > 0;
}

// Avant de transférer une soumission (bon ou facture) : manque-t-il du stock
// pour ses pièces d'inventaire ? Vérifié avant de créer quoi que ce soit
// (client, véhicule, bon). Message, ou null si tout y est (ou si le profil
// stockNegatifBons permet de descendre sous 0). taches doivent inclure pieces.
async function manqueStockSoumission(soumission) {
  if (CLIENT.stockNegatifBons) return null;
  const lignes = soumission.taches.flatMap((t) => t.pieces).filter(sortDuStock);
  if (lignes.length === 0) return null;
  const pieces = await prisma.piece.findMany({ where: { id: { in: lignes.map((l) => l.pieceId) } }, include: { composantsKit: true } });
  const parId = new Map(pieces.map((p) => [p.id, p]));
  const besoins = new Map(); // pieceId → quantité à sortir
  const ajouter = (id, qte) => besoins.set(id, (besoins.get(id) || 0) + qte);
  for (const l of lignes) {
    const piece = parId.get(l.pieceId);
    if (!piece) continue;
    if (!piece.estKit) {
      ajouter(piece.id, l.qte);
      continue;
    }
    for (const c of piece.composantsKit) {
      if (c.pieceId) ajouter(c.pieceId, c.qte * l.qte);
    }
  }
  const stocks = await prisma.piece.findMany({ where: { id: { in: [...besoins.keys()] } }, select: { id: true, nom: true, qte: true } });
  const manques = stocks.filter((p) => p.qte < besoins.get(p.id)).map((p) => `${p.nom} (${p.qte} en stock, ${besoins.get(p.id)} requis)`);
  return manques.length
    ? `Stock insuffisant pour les pièces de l'inventaire de cette soumission : ${manques.join(", ")}. Reçois la marchandise ou ajuste la soumission.`
    : null;
}

// Sort du stock une pièce d'inventaire de la soumission vers une tâche du
// bon (dans la transaction tx), au prix promis sur la soumission. probleme
// doit inclure bon.client. Erreur « PIECE_SOUMISSION:<message> » si la pièce
// n'est plus utilisable (voir messagePieceSoumission).
async function sortirPieceSoumissionDuStock(tx, { probleme, pieceEstimee, creePar }) {
  const piece = await tx.piece.findUnique({ where: { id: pieceEstimee.pieceId } });
  if (!piece) throw new Error(`PIECE_SOUMISSION:${pieceEstimee.nom} n'existe plus dans l'inventaire.`);
  if (!piece.actif) throw new Error(`PIECE_SOUMISSION:${piece.nom} est désactivée dans l'inventaire.`);
  const args = { probleme, quantite: pieceEstimee.qte, creePar, prix: pieceEstimee.prixEstime };
  try {
    return piece.estKit
      ? await sortirKitDuStockPourBon(tx, { ...args, kit: piece })
      : await sortirDuStockPourBon(tx, { ...args, piece });
  } catch (e) {
    if (e.message === "STOCK_INSUFFISANT") throw new Error(`PIECE_SOUMISSION:Stock insuffisant pour ${piece.nom} (${piece.qte} en stock, ${pieceEstimee.qte} sur la soumission).`);
    if (e.message.startsWith("STOCK_KIT:")) throw new Error(`PIECE_SOUMISSION:Stock insuffisant pour le kit ${piece.nom} : ${e.message.slice(10)}.`);
    throw e;
  }
}

// Message à montrer pour une erreur de sortirPieceSoumissionDuStock, sinon null
function messagePieceSoumission(e) {
  return e?.message?.startsWith("PIECE_SOUMISSION:") ? e.message.slice("PIECE_SOUMISSION:".length) : null;
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

// Inventaire offert dans le formulaire de soumission : seulement ce
// qu'utilisent le choix et la recherche (l'inventaire peut compter des
// milliers de pièces). Un kit n'a pas de stock à lui : sa quantité est le
// nombre de kits que le stock de ses pièces permet de faire (999 : sans pièce).
async function inventairePourSoumission() {
  const { kitsDisponibles } = require("./kits");
  return (await prisma.piece.findMany({
    where: { actif: true },
    select: {
      id: true, nom: true, numero: true, autresNumeros: true, codeBarre: true, qte: true, prix: true, estKit: true,
      fournisseurs: { select: { numeroFournisseur: true } },
      composantsKit: { select: { pieceId: true, qte: true, piece: { select: { qte: true } } } },
    },
    orderBy: { nom: "asc" },
  })).map(({ composantsKit, ...p }) => (p.estKit ? { ...p, qte: kitsDisponibles(composantsKit) ?? 999 } : p));
}

module.exports = {
  lireVehiculeSoumission, adresseClientSoumission, clientEtVehiculeDuBon, totauxSoumission, quantiteSoumission, reparerEcrituresFacturesSoumissions,
  tachesSoumissionPourPrisma, sortDuStock, manqueStockSoumission, sortirPieceSoumissionDuStock, messagePieceSoumission, inventairePourSoumission,
};
