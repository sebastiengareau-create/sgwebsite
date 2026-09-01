// ============================================================
// MOTEUR DE CALCUL DE PAIE — Québec, année 2026
//
// ⚠️ CECI EST UN OUTIL D'ESTIMATION, PAS UN CALCUL CERTIFIÉ.
// Utilise la méthode d'annualisation (convertir en équivalent annuel,
// appliquer les paliers, reconvertir par période) — une approximation
// standard, mais qui ne remplace pas la formule officielle complète de
// Revenu Québec (TP-1015.F) pour un usage réel de paie. Toujours valider
// avec l'outil gratuit WebRAS de Revenu Québec avant de verser une vraie
// paie : https://www.revenuquebec.ca/fr/services-en-ligne/outils/webras/
//
// Sources (2026, vérifiées) :
// - Revenu Québec : paliers d'imposition, RRQ, RQAP
// - ARC / Commission de l'assurance-emploi : paliers fédéraux, AE
// ============================================================

const { prisma } = require("./prisma");

const PERIODES_PAR_AN = {
  HEBDOMADAIRE: 52,
  BIHEBDOMADAIRE: 26,
  BIMENSUEL: 24,
  MENSUEL: 12,
};

// ---- RRQ 2026 ----
const RRQ = {
  exemptionGenerale: 3500,
  maxGainsAdmissibles: 74600,
  maxSupplementaire: 85000,
  tauxBase: 0.063, // 5,30 % + 1re cotisation supplémentaire 1 %
  tauxSupplementaire2: 0.04, // 2e cotisation supplémentaire (74 600 $ à 85 000 $)
  maxEmploye: 4479.30,
  maxEmployeSupplementaire2: 416,
};

// ---- RQAP 2026 ----
const RQAP = {
  maxAssurable: 103000,
  tauxEmploye: 0.00430,
  tauxEmployeur: 0.00602,
  maxEmploye: 442.90,
  maxEmployeur: 620.06,
};

// ---- Assurance-emploi 2026 (taux réduit Québec) ----
const AE = {
  maxAssurable: 68900,
  tauxEmploye: 0.0130,
  tauxEmployeur: 0.0182, // 1,4 × taux employé
  maxEmploye: 895.70,
  maxEmployeur: 1253.98,
};

// ---- Impôt provincial (Québec) 2026 ----
const PALIERS_QC = [
  { jusqu_a: 54345, taux: 0.14 },
  { jusqu_a: 108680, taux: 0.19 },
  { jusqu_a: 132245, taux: 0.24 },
  { jusqu_a: Infinity, taux: 0.2575 },
];
const MONTANT_PERSONNEL_QC = 18952;

// ---- Impôt fédéral 2026 ----
const PALIERS_FED = [
  { jusqu_a: 58523, taux: 0.14 },
  { jusqu_a: 117040, taux: 0.205 },
  { jusqu_a: 181440, taux: 0.26 },
  { jusqu_a: 258482, taux: 0.29 },
  { jusqu_a: Infinity, taux: 0.33 },
];
const MONTANT_PERSONNEL_FED = 16452;
const ABATTEMENT_QUEBEC = 0.165; // réduction de l'impôt fédéral de base pour les résidents du Québec

function impotParPaliers(revenuImposable, paliers) {
  let impot = 0;
  let precedent = 0;
  for (const p of paliers) {
    if (revenuImposable <= precedent) break;
    const portion = Math.min(revenuImposable, p.jusqu_a) - precedent;
    impot += portion * p.taux;
    precedent = p.jusqu_a;
  }
  return impot;
}

/**
 * Calcule une paie complète pour une période.
 * `dejaVerseAnnee` = cotisations déjà versées cette année (pour ne pas
 * dépasser les maximums annuels) — { rrq, rqap, ae }, tous à 0 par défaut.
 */
function calculerPaie(salaireBrutPeriode, frequencePaie, dejaVerseAnnee = { rrq: 0, rqap: 0, ae: 0 }) {
  const periodesParAn = PERIODES_PAR_AN[frequencePaie] || 26;
  const brutAnnuel = salaireBrutPeriode * periodesParAn;

  // --- RRQ ---
  const gainsAdmissiblesPeriode = Math.max(0, salaireBrutPeriode - RRQ.exemptionGenerale / periodesParAn);
  let rrqEmploye = gainsAdmissiblesPeriode * RRQ.tauxBase;
  rrqEmploye = Math.min(rrqEmploye, Math.max(0, RRQ.maxEmploye - dejaVerseAnnee.rrq));

  // --- RQAP ---
  let rqapEmploye = salaireBrutPeriode * RQAP.tauxEmploye;
  rqapEmploye = Math.min(rqapEmploye, Math.max(0, RQAP.maxEmploye - dejaVerseAnnee.rqap));

  // --- Assurance-emploi ---
  let aeEmploye = salaireBrutPeriode * AE.tauxEmploye;
  aeEmploye = Math.min(aeEmploye, Math.max(0, AE.maxEmploye - dejaVerseAnnee.ae));

  // --- Revenu imposable annualisé (RRQ et RQAP sont déductibles) ---
  const revenuImposableAnnuel = Math.max(0, brutAnnuel - rrqEmploye * periodesParAn - rqapEmploye * periodesParAn);

  // --- Impôt fédéral (avec abattement du Québec) ---
  const impotFedBrutAnnuel = Math.max(0, impotParPaliers(revenuImposableAnnuel, PALIERS_FED) - MONTANT_PERSONNEL_FED * PALIERS_FED[0].taux);
  const impotFedAnnuel = impotFedBrutAnnuel * (1 - ABATTEMENT_QUEBEC);
  const impotFederal = impotFedAnnuel / periodesParAn;

  // --- Impôt provincial (Québec) ---
  const impotQcAnnuel = Math.max(0, impotParPaliers(revenuImposableAnnuel, PALIERS_QC) - MONTANT_PERSONNEL_QC * PALIERS_QC[0].taux);
  const impotQuebec = impotQcAnnuel / periodesParAn;

  const totalDeductions = rrqEmploye + rqapEmploye + aeEmploye + impotFederal + impotQuebec;
  const salaireNet = salaireBrutPeriode - totalDeductions;

  // --- Part employeur ---
  const rrqEmployeur = rrqEmploye; // même montant
  const rqapEmployeur = salaireBrutPeriode * RQAP.tauxEmployeur;
  const aeEmployeur = aeEmploye * 1.4;

  return {
    salaireBrutPeriode: arrondir(salaireBrutPeriode),
    rrqEmploye: arrondir(rrqEmploye),
    rqapEmploye: arrondir(rqapEmploye),
    aeEmploye: arrondir(aeEmploye),
    impotFederal: arrondir(impotFederal),
    impotQuebec: arrondir(impotQuebec),
    totalDeductions: arrondir(totalDeductions),
    salaireNet: arrondir(salaireNet),
    rrqEmployeur: arrondir(rrqEmployeur),
    rqapEmployeur: arrondir(rqapEmployeur),
    aeEmployeur: arrondir(aeEmployeur),
  };
}

function arrondir(n) {
  return Math.round(n * 100) / 100;
}

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}

// Calcule la paie d'UN employé pour une période — logique partagée entre
// l'ancien endpoint ponctuel (app/api/paie/calculer/route.js) et le
// traitement par lot (app/api/paie/lots/route.js), pour ne jamais diverger.
// Retourne { erreur } si l'employé est introuvable ou les dates invalides.
async function calculerPaiePourEmploye(employeId, { periodeDebut, periodeFin, typePaie, heuresManuelles, montantVacances } = {}) {
  const employe = await prisma.user.findUnique({ where: { id: employeId } });
  if (!employe) return { erreur: "Employé introuvable." };

  const debut = new Date(periodeDebut);
  const fin = new Date(periodeFin);
  if (!periodeDebut || !periodeFin || fin <= debut) return { erreur: "Période invalide." };

  // Solde de vacances disponible — accumulé sur les paies régulières VERSÉES
  // (jamais un brouillon, qui n'est pas encore réel), moins ce qui a déjà
  // été versé via une paie de vacances précédente.
  const [accumule, dejaVerse] = await Promise.all([
    prisma.paie.aggregate({ where: { employeId, statut: "VERSEE", typePaie: "REGULIERE" }, _sum: { vacancesAccumulees: true } }),
    prisma.paie.aggregate({ where: { employeId, statut: "VERSEE", typePaie: "VACANCES" }, _sum: { salaireBrut: true } }),
  ]);
  const soldeVacances = Math.max(0, (accumule._sum.vacancesAccumulees || 0) - (dejaVerse._sum.salaireBrut || 0));

  let heuresTravaillees = 0;
  let heuresHorodateur = null;
  let salaireBrutPeriode = 0;

  if (typePaie === "VACANCES") {
    salaireBrutPeriode = montantVacances !== undefined && montantVacances !== "" ? Number(montantVacances) : soldeVacances;
  } else if (employe.typeRemuneration === "SALAIRE") {
    const periodesParAn = PERIODES_PAR_AN[employe.frequencePaie] || 26;
    salaireBrutPeriode = (employe.salaireAnnuel || 0) / periodesParAn;
  } else {
    const [entrees, entreesInternes, parametreTaux] = await Promise.all([
      prisma.entreeTemps.findMany({ where: { employeId, fin: { not: null }, debut: { gte: debut, lte: fin } } }),
      prisma.entreeTempsInterne.findMany({ where: { employeId, fin: { not: null }, debut: { gte: debut, lte: fin } } }),
      prisma.parametre.findUnique({ where: { cle: "cout_horaire_mecanicien" } }),
    ]);
    heuresHorodateur =
      entrees.reduce((s, e) => s + dureeHeures(e.debut, e.fin), 0) +
      entreesInternes.reduce((s, e) => s + dureeHeures(e.debut, e.fin), 0);
    heuresTravaillees = heuresManuelles !== undefined && heuresManuelles !== null && heuresManuelles !== ""
      ? Number(heuresManuelles)
      : heuresHorodateur;
    const taux = employe.tauxHoraireEmploye || Number(parametreTaux?.valeur || 95);
    salaireBrutPeriode = heuresTravaillees * taux;
  }

  // Cotisations déjà versées cette année (paies VERSÉES seulement — un
  // brouillon ne compte pas encore, une correction ne compte plus), pour
  // respecter les maximums annuels.
  const anneeCourante = fin.getFullYear();
  const paiesAnnee = await prisma.paie.findMany({
    where: { employeId, statut: "VERSEE", periodeFin: { gte: new Date(`${anneeCourante}-01-01`), lt: new Date(`${anneeCourante + 1}-01-01`) } },
  });
  const dejaVerseAnnee = paiesAnnee.reduce(
    (acc, p) => ({ rrq: acc.rrq + p.rrqEmploye, rqap: acc.rqap + p.rqapEmploye, ae: acc.ae + p.aeEmploye }),
    { rrq: 0, rqap: 0, ae: 0 }
  );

  const resultat = calculerPaie(salaireBrutPeriode, employe.frequencePaie, dejaVerseAnnee);
  const vacancesAccumulees = typePaie === "VACANCES" ? 0 : Math.round(salaireBrutPeriode * (employe.tauxVacances / 100) * 100) / 100;

  return {
    employe: { id: employe.id, nom: employe.nom, typeRemuneration: employe.typeRemuneration, frequencePaie: employe.frequencePaie, tauxVacances: employe.tauxVacances },
    heuresTravaillees,
    heuresHorodateur,
    vacancesAccumulees,
    soldeVacances,
    typePaie: typePaie === "VACANCES" ? "VACANCES" : "REGULIERE",
    ...resultat,
  };
}

module.exports = { calculerPaie, calculerPaiePourEmploye, PERIODES_PAR_AN, RRQ, RQAP, AE };
