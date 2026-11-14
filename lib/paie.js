// ============================================================
// MOTEUR DE CALCUL DE PAIE — Québec (taux par année : TAUX_PAR_ANNEE)
//
// ⚠️ CECI EST UN OUTIL D'ESTIMATION, PAS UN CALCUL CERTIFIÉ.
// Utilise la méthode d'annualisation (convertir en équivalent annuel,
// appliquer les paliers, reconvertir par période) — une approximation
// standard, mais qui ne remplace pas la formule officielle complète de
// Revenu Québec (TP-1015.F) pour un usage réel de paie. Toujours valider
// avec l'outil gratuit WebRAS de Revenu Québec avant de verser une vraie
// paie : https://www.revenuquebec.ca/fr/services-en-ligne/outils/webras/
//
// Sources des taux :
// - Revenu Québec : paliers d'imposition, RRQ, RQAP
// - ARC / Commission de l'assurance-emploi : paliers fédéraux, AE
// ============================================================

const { prisma } = require("./prisma");
const { joursCalendairesQuebec, dateQuebecStr, limitesMoisQuebec } = require("./temps");

const CLES_HORAIRE = ["heures_lun", "heures_mar", "heures_mer", "heures_jeu", "heures_ven", "heures_sam", "heures_dim"];
// Rôles payés pour tout l'horaire d'ouverture, poinçon ou non.
const ROLES_HORAIRE_COMPLET = ["SECRETAIRE", "GERANT", "NIVEAU4"];
const DEFAUTS_HORAIRE = { lun: 8, mar: 8, mer: 8, jeu: 8, ven: 5, sam: 0, dim: 0 };

const PERIODES_PAR_AN = {
  HEBDOMADAIRE: 52,
  BIHEBDOMADAIRE: 26,
  BIMENSUEL: 24,
  MENSUEL: 12,
};

// ---- Taux et maximums, par année de versement ----
// Une entrée par année. Pour une nouvelle année : copier la dernière entrée,
// mettre à jour les montants publiés par Revenu Québec et l'ARC, et c'est
// tout — le calcul prend la table de l'année où la paie est VERSÉE.
// Une année sans table utilise la plus récente connue et le signale
// (tauxAJour: false — voir tauxPourAnnee et lib/checklistLot.js).
const TAUX_PAR_ANNEE = {
  2026: {
    RRQ: {
      exemptionGenerale: 3500,
      maxGainsAdmissibles: 74600,
      maxSupplementaire: 85000,
      tauxBase: 0.063, // 5,30 % + 1re cotisation supplémentaire 1 %
      tauxSupplementaire2: 0.04, // 2e cotisation supplémentaire (74 600 $ à 85 000 $)
      maxEmploye: 4479.30,
      maxEmployeSupplementaire2: 416,
    },
    RQAP: {
      maxAssurable: 103000,
      tauxEmploye: 0.00430,
      tauxEmployeur: 0.00602,
      maxEmploye: 442.90,
      maxEmployeur: 620.06,
    },
    // Assurance-emploi, taux réduit du Québec
    AE: {
      maxAssurable: 68900,
      tauxEmploye: 0.0130,
      tauxEmployeur: 0.0182, // 1,4 × taux employé
      maxEmploye: 895.70,
      maxEmployeur: 1253.98,
    },
    PALIERS_QC: [
      { jusqu_a: 54345, taux: 0.14 },
      { jusqu_a: 108680, taux: 0.19 },
      { jusqu_a: 132245, taux: 0.24 },
      { jusqu_a: Infinity, taux: 0.2575 },
    ],
    MONTANT_PERSONNEL_QC: 18952,
    PALIERS_FED: [
      { jusqu_a: 58523, taux: 0.14 },
      { jusqu_a: 117040, taux: 0.205 },
      { jusqu_a: 181440, taux: 0.26 },
      { jusqu_a: 258482, taux: 0.29 },
      { jusqu_a: Infinity, taux: 0.33 },
    ],
    MONTANT_PERSONNEL_FED: 16452,
    ABATTEMENT_QUEBEC: 0.165, // réduction de l'impôt fédéral de base pour les résidents du Québec
  },
};
const ANNEES_TAUX = Object.keys(TAUX_PAR_ANNEE).map(Number).sort((x, y) => x - y);
const DERNIERE_ANNEE_TAUX = ANNEES_TAUX[ANNEES_TAUX.length - 1];

// Table de taux d'une année de versement. Sans table pour cette année : la
// plus récente qui la précède (ou la plus ancienne connue), avec
// tauxAJour: false pour que l'écran avertisse.
function tauxPourAnnee(annee) {
  const connue = [...ANNEES_TAUX].reverse().find((a) => a <= annee) || ANNEES_TAUX[0];
  return { ...TAUX_PAR_ANNEE[connue], anneeTaux: connue, tauxAJour: connue === Number(annee) };
}

// Année civile (Québec) d'une date — celle qui compte pour les maximums
// annuels et les feuillets est l'année du VERSEMENT, pas celle de la période.
function anneeQuebec(date) {
  return Number(dateQuebecStr(date).slice(0, 4));
}

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
 * dépasser les maximums annuels) — { rrq, rrq2, rqap, rqapEmployeur, ae },
 * et `gains` : le brut déjà versé cette année (pour la 2e cotisation
 * supplémentaire au RRQ, qui ne s'applique qu'au-delà du MGA). Tous à 0 par
 * défaut. `annee` = année du versement, qui choisit la table de taux.
 */
function calculerPaie(salaireBrutPeriode, frequencePaie, dejaVerseAnnee = {}, annee = anneeQuebec(new Date())) {
  dejaVerseAnnee = { rrq: 0, rrq2: 0, rqap: 0, rqapEmployeur: 0, ae: 0, gains: 0, ...dejaVerseAnnee };
  const { RRQ, RQAP, AE, PALIERS_QC, MONTANT_PERSONNEL_QC, PALIERS_FED, MONTANT_PERSONNEL_FED, ABATTEMENT_QUEBEC, anneeTaux, tauxAJour } = tauxPourAnnee(annee);
  const periodesParAn = PERIODES_PAR_AN[frequencePaie] || 26;
  const brutAnnuel = salaireBrutPeriode * periodesParAn;

  // --- RRQ ---
  const gainsAdmissiblesPeriode = Math.max(0, salaireBrutPeriode - RRQ.exemptionGenerale / periodesParAn);
  let rrqEmploye = gainsAdmissiblesPeriode * RRQ.tauxBase;
  rrqEmploye = Math.min(rrqEmploye, Math.max(0, RRQ.maxEmploye - dejaVerseAnnee.rrq));

  // --- RRQ, 2e cotisation supplémentaire ---
  // Sur la partie des gains cumulés de l'année entre le MGA (74 600 $) et le
  // MSGA (85 000 $) : ne commence qu'une fois le MGA dépassé dans l'année.
  const gainsCumules = dejaVerseAnnee.gains + salaireBrutPeriode;
  const tranche2 = Math.max(0, Math.min(gainsCumules, RRQ.maxSupplementaire) - Math.max(dejaVerseAnnee.gains, RRQ.maxGainsAdmissibles));
  let rrq2Employe = tranche2 * RRQ.tauxSupplementaire2;
  rrq2Employe = Math.min(rrq2Employe, Math.max(0, RRQ.maxEmployeSupplementaire2 - dejaVerseAnnee.rrq2));

  // --- RQAP ---
  let rqapEmploye = salaireBrutPeriode * RQAP.tauxEmploye;
  rqapEmploye = Math.min(rqapEmploye, Math.max(0, RQAP.maxEmploye - dejaVerseAnnee.rqap));

  // --- Assurance-emploi ---
  let aeEmploye = salaireBrutPeriode * AE.tauxEmploye;
  aeEmploye = Math.min(aeEmploye, Math.max(0, AE.maxEmploye - dejaVerseAnnee.ae));

  // --- Revenu imposable annualisé (RRQ et RQAP sont déductibles) ---
  const revenuImposableAnnuel = Math.max(0, brutAnnuel - (rrqEmploye + rrq2Employe + rqapEmploye) * periodesParAn);

  // --- Impôt fédéral (avec abattement du Québec) ---
  const impotFedBrutAnnuel = Math.max(0, impotParPaliers(revenuImposableAnnuel, PALIERS_FED) - MONTANT_PERSONNEL_FED * PALIERS_FED[0].taux);
  const impotFedAnnuel = impotFedBrutAnnuel * (1 - ABATTEMENT_QUEBEC);
  const impotFederal = impotFedAnnuel / periodesParAn;

  // --- Impôt provincial (Québec) ---
  const impotQcAnnuel = Math.max(0, impotParPaliers(revenuImposableAnnuel, PALIERS_QC) - MONTANT_PERSONNEL_QC * PALIERS_QC[0].taux);
  const impotQuebec = impotQcAnnuel / periodesParAn;

  const totalDeductions = rrqEmploye + rrq2Employe + rqapEmploye + aeEmploye + impotFederal + impotQuebec;
  const salaireNet = salaireBrutPeriode - totalDeductions;

  // --- Part employeur ---
  const rrqEmployeur = rrqEmploye; // même montant
  const rrq2Employeur = rrq2Employe;
  const rqapEmployeur = Math.min(salaireBrutPeriode * RQAP.tauxEmployeur, Math.max(0, RQAP.maxEmployeur - dejaVerseAnnee.rqapEmployeur));
  const aeEmployeur = aeEmploye * 1.4;

  return {
    salaireBrutPeriode: arrondir(salaireBrutPeriode),
    rrqEmploye: arrondir(rrqEmploye),
    rrq2Employe: arrondir(rrq2Employe),
    rqapEmploye: arrondir(rqapEmploye),
    aeEmploye: arrondir(aeEmploye),
    impotFederal: arrondir(impotFederal),
    impotQuebec: arrondir(impotQuebec),
    totalDeductions: arrondir(totalDeductions),
    salaireNet: arrondir(salaireNet),
    rrqEmployeur: arrondir(rrqEmployeur),
    rrq2Employeur: arrondir(rrq2Employeur),
    rqapEmployeur: arrondir(rqapEmployeur),
    aeEmployeur: arrondir(aeEmployeur),
    anneeTaux,
    tauxAJour,
  };
}

function arrondir(n) {
  return Math.round(n * 100) / 100;
}

// Horaire d'ouverture du commerce (Paramètres heures_lun…heures_dim),
// complété par les valeurs par défaut pour les jours non configurés.
async function chargerHoraireOuverture() {
  const parametresHoraire = await prisma.parametre.findMany({ where: { cle: { in: CLES_HORAIRE } } });
  const dictHoraire = Object.fromEntries(parametresHoraire.map((p) => [p.cle.replace("heures_", ""), Number(p.valeur)]));
  return { ...DEFAUTS_HORAIRE, ...dictHoraire };
}

// Heures attribuées selon les jours poinçonnés : chaque jour (Québec) où
// l'employé a au moins un poinçon compte pour l'horaire prévu CE jour-là
// (ex. lundi + mardi poinçonnés = 8h + 8h = 16h), peu importe la durée
// exacte poinçonnée. Partagé entre la paie et le rapport de rentabilité.
function heuresPrevuesJoursPoinconnes(entrees, debut, fin, horaire) {
  const joursTravailles = new Set(entrees.map((e) => dateQuebecStr(e.debut)));
  return joursCalendairesQuebec(debut, fin).reduce((s, j) => s + (joursTravailles.has(j.dateStr) ? (horaire[j.jour] || 0) : 0), 0);
}

// Heures payées par défaut selon le rôle (voir calculerPaiePourEmploye) :
// la secrétaire, le gérant et le niveau 4 sont payés pour tout l'horaire
// d'ouverture de la période ; les autres (mécanicien), pour l'horaire des
// jours poinçonnés seulement.
function heuresPayeesParDefaut(employe, entrees, debut, fin, horaire) {
  if (ROLES_HORAIRE_COMPLET.includes(employe.role)) {
    return joursCalendairesQuebec(debut, fin).reduce((s, j) => s + (horaire[j.jour] || 0), 0);
  }
  return heuresPrevuesJoursPoinconnes(entrees, debut, fin, horaire);
}

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}

// Calcule la paie d'UN employé pour une période — logique partagée entre
// l'ancien endpoint ponctuel (app/api/paie/calculer/route.js) et le
// traitement par lot (app/api/paie/lots/route.js), pour ne jamais diverger.
// Retourne { erreur } si l'employé est introuvable ou les dates invalides.
// `dateVersement` (à défaut, la fin de la période) fixe l'année des taux et
// des maximums annuels — la même règle que les feuillets (lib/feuilletsFiscaux.js).
async function calculerPaiePourEmploye(employeId, { periodeDebut, periodeFin, dateVersement, typePaie, heuresManuelles, montantVacances, boni } = {}) {
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
    const [entrees, entreesInternes, parametreTaux, horaireFinal] = await Promise.all([
      prisma.entreeTemps.findMany({ where: { employeId, fin: { not: null }, debut: { gte: debut, lte: fin } } }),
      prisma.entreeTempsInterne.findMany({ where: { employeId, fin: { not: null }, debut: { gte: debut, lte: fin } } }),
      prisma.parametre.findUnique({ where: { cle: "cout_horaire_mecanicien" } }),
      chargerHoraireOuverture(),
    ]);
    heuresHorodateur =
      entrees.reduce((s, e) => s + dureeHeures(e.debut, e.fin), 0) +
      entreesInternes.reduce((s, e) => s + dureeHeures(e.debut, e.fin), 0);

    // Heures par défaut = l'horaire d'ouverture du commerce (Paramètres),
    // pas les heures réellement poinçonnées :
    // - Secrétaire, gérant, niveau 4 : toutes les heures d'ouverture
    //   prévues sur la période (peu importe le poinçon).
    // - Autres (mécanicien…) : seulement les jours où au moins un poinçon
    //   existe, chacun compté pour l'horaire prévu CE jour-là (ex. vendredi
    //   = 5h prévues) plutôt que la durée exacte poinçonnée. Le vrai total
    //   poinçonné (heuresHorodateur) reste affiché à titre indicatif.
    const heuresParDefaut = heuresPayeesParDefaut(employe, [...entrees, ...entreesInternes], debut, fin, horaireFinal);

    heuresTravaillees = heuresManuelles !== undefined && heuresManuelles !== null && heuresManuelles !== ""
      ? Number(heuresManuelles)
      : heuresParDefaut;
    // Taux propre à l'employé ; à défaut, le taux global des Paramètres s'il
    // a été réglé. Jamais de montant inventé : sans l'un ni l'autre, on
    // refuse de calculer plutôt que de payer un taux que personne n'a choisi.
    const taux = employe.tauxHoraireEmploye || Number(parametreTaux?.valeur) || 0;
    if (!(taux > 0)) {
      return { erreur: `Aucun taux horaire pour ${employe.nom} : inscris-le dans sa fiche d'employé.` };
    }
    salaireBrutPeriode = heuresTravaillees * taux;
  }

  // Le boni s'ajoute au brut de base et suit les mêmes déductions — jamais
  // appliqué sur une paie de vacances (le montant de vacances EST déjà le
  // versement complet).
  const boniFinal = typePaie === "VACANCES" ? 0 : Number(boni) || 0;
  const salaireBase = salaireBrutPeriode;
  salaireBrutPeriode += boniFinal;

  // Cotisations déjà versées cette année (paies VERSÉES seulement — un
  // brouillon ne compte pas encore, une correction ne compte plus), pour
  // respecter les maximums annuels. L'année est celle du versement.
  const annee = anneeQuebec(dateVersement ? new Date(dateVersement) : fin);
  const debutAnnee = limitesMoisQuebec(annee, 1).debut;
  const finAnnee = limitesMoisQuebec(annee, 12).fin;
  const paiesAnnee = await prisma.paie.findMany({
    where: {
      employeId, statut: "VERSEE",
      // Date de versement ; à défaut (ancienne paie), la fin de la période
      OR: [{ dateVersement: { gte: debutAnnee, lte: finAnnee } }, { dateVersement: null, periodeFin: { gte: debutAnnee, lte: finAnnee } }],
    },
  });
  const dejaVerseAnnee = paiesAnnee.reduce(
    (acc, p) => ({
      rrq: acc.rrq + p.rrqEmploye, rrq2: acc.rrq2 + p.rrq2Employe, rqap: acc.rqap + p.rqapEmploye,
      rqapEmployeur: acc.rqapEmployeur + p.rqapEmployeur, ae: acc.ae + p.aeEmploye, gains: acc.gains + p.salaireBrut,
    }),
    { rrq: 0, rrq2: 0, rqap: 0, rqapEmployeur: 0, ae: 0, gains: 0 }
  );

  const resultat = calculerPaie(salaireBrutPeriode, employe.frequencePaie, dejaVerseAnnee, annee);
  const vacancesAccumulees = typePaie === "VACANCES" ? 0 : Math.round(salaireBrutPeriode * (employe.tauxVacances / 100) * 100) / 100;

  return {
    employe: {
      id: employe.id, nom: employe.nom, typeRemuneration: employe.typeRemuneration, frequencePaie: employe.frequencePaie,
      tauxVacances: employe.tauxVacances, tauxHoraireEmploye: employe.tauxHoraireEmploye, salaireAnnuel: employe.salaireAnnuel,
    },
    heuresTravaillees,
    heuresHorodateur,
    salaireBase,
    boni: boniFinal,
    vacancesAccumulees,
    soldeVacances,
    typePaie: typePaie === "VACANCES" ? "VACANCES" : "REGULIERE",
    ...resultat,
  };
}

module.exports = { calculerPaie, calculerPaiePourEmploye, chargerHoraireOuverture, heuresPrevuesJoursPoinconnes, tauxPourAnnee, anneeQuebec, PERIODES_PAR_AN, DERNIERE_ANNEE_TAUX };
