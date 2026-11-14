// ============================================================
// MOTEUR DE CALCUL DE PAIE — Québec (taux par année : TAUX_PAR_ANNEE)
//
// Retenues calculées selon les formules publiées par les gouvernements :
// - Revenu Québec, guide TP-1015.F (2026-01) : impôt du Québec (partie 2.1.1),
//   gratifications (partie 2.1.2, seconde méthode), RRQ (partie 3), RQAP
//   (partie 4). Les exemples des annexes 1 à 3 servent de tests
//   (scripts/tester-paie.js).
// - ARC, guide T4127 : impôt fédéral, option 1, employé du Québec. Taux,
//   seuils, constantes, montant canadien pour emploi et abattement tirés de
//   la 123e édition (juillet 2026) ; le texte des formules (A, K2Q, MPBF,
//   primes) vient de la 122e édition, que la 123e ne reproduit pas.
//
// ⚠️ Ce logiciel n'est pas certifié par Revenu Québec ni par l'ARC. Cas non
// couverts : commissions, cotisations à un REER/RPA retenues sur la paie,
// fonds de travailleurs, exemptions (RRQ selon l'âge, AE du propriétaire),
// déductions autorisées (TP-1016), employé qui commence ou cesse de cotiser
// au RRQ en cours d'année. Dans ces cas, valider avec WebRAS :
// https://www.revenuquebec.ca/fr/services-en-ligne/outils/webras/
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
// Une entrée par année. Pour une nouvelle année : copier la dernière entrée
// et mettre à jour les montants publiés par Revenu Québec (TP-1015.F) et
// l'ARC (T4127) — le calcul prend la table de l'année où la paie est VERSÉE.
// Une année sans table utilise la plus récente connue et le signale
// (tauxAJour: false — voir tauxPourAnnee et lib/checklistLot.js).
const TAUX_PAR_ANNEE = {
  2026: {
    // TP-1015.F, « Cotisations au RRQ »
    RRQ: {
      exemptionGenerale: 3500,
      maxGainsAdmissibles: 74600,
      maxSupplementaire: 85000,
      tauxBase: 0.063, // taux de cotisation : 5,30 % de base + 1 % de première cotisation supplémentaire
      tauxBaseSeul: 0.053,
      tauxPremiereSupplementaire: 0.01,
      tauxSupplementaire2: 0.04, // 2e cotisation supplémentaire (74 600 $ à 85 000 $)
      maxEmploye: 4479.30,
      maxEmployeSupplementaire2: 416,
    },
    // TP-1015.F, « Cotisations au RQAP »
    RQAP: {
      maxAssurable: 103000,
      tauxEmploye: 0.00430,
      tauxEmployeur: 0.00602,
      maxEmploye: 442.90,
      maxEmployeur: 620.06,
    },
    // Assurance-emploi, taux réduit du Québec (T4127, chapitre 7)
    AE: {
      maxAssurable: 68900,
      tauxEmploye: 0.0130,
      tauxEmployeur: 0.0182, // 1,4 × taux employé
      maxEmploye: 895.70,
      maxEmployeur: 1253.98,
    },
    // Impôt du Québec — TP-1015.F, partie 2 : seuils, taux (T) et constantes (K)
    QC: {
      paliers: [
        { jusqu_a: 54345, taux: 0.14, constante: 0 },
        { jusqu_a: 108680, taux: 0.19, constante: 2717 },
        { jusqu_a: 132245, taux: 0.24, constante: 8151 },
        { jusqu_a: Infinity, taux: 0.2575, constante: 10465 },
      ],
      tauxCredit: 0.14, // appliqué à E (crédits personnels du TP-1015.3)
      montantBase: 18952, // montant personnel de base (E sans formulaire TP-1015.3)
      deductionTravailleurTaux: 0.06, // variable H
      deductionTravailleurMax: 1450,
      seuilGratification: 18952, // salaire annuel + forfaitaire à ce seuil ou moins : retenue fixe
      tauxGratificationSousSeuil: 0.07,
    },
    // Impôt fédéral — T4127, tableaux 8.1 et 8.2 : seuils (A), taux (R), constantes (K)
    FED: {
      paliers: [
        { jusqu_a: 58523, taux: 0.14, constante: 0 },
        { jusqu_a: 117045, taux: 0.205, constante: 3804 },
        { jusqu_a: 181440, taux: 0.26, constante: 10241 },
        { jusqu_a: 258482, taux: 0.29, constante: 15685 },
        { jusqu_a: Infinity, taux: 0.33, constante: 26024 },
      ],
      tauxCredit: 0.14, // taux fédéral le moins élevé, pour K1, K2Q et K4
      // Montant personnel de base fédéral (MPBF) : plein jusqu'au seuil du
      // 4e palier, réduit graduellement jusqu'au minimum au seuil du 5e
      montantBase: 16452,
      montantBaseMin: 14829,
      montantBaseSeuilReduction: 181440,
      montantBaseSeuilMin: 258482,
      montantEmploi: 1501, // montant canadien pour emploi (CCE), pour K4
      abattementQuebec: 0.165,
    },
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

// Arrondi au cent, le demi-cent comptant pour un cent (TP-1015.F, parties 3 et 4)
function arrondir(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Une cotisation supérieure à 0 $ mais inférieure à un cent se retient à un cent
function arrondirCotisation(n) {
  if (!(n > 0)) return 0;
  return Math.max(0.01, arrondir(n));
}

// Palier (taux et constante) applicable à un revenu imposable annuel
function palierPour(revenu, paliers) {
  return paliers.find((p) => revenu <= p.jusqu_a);
}

// Impôt annuel selon les paliers : (taux × revenu) – constante
function impotAnnuel(revenu, paliers) {
  const p = palierPour(revenu, paliers);
  return p.taux * revenu - p.constante;
}

// Montant personnel de base fédéral selon le revenu net annuel (T4127, MPBF)
function montantBaseFederal(revenuNet, FED) {
  if (revenuNet <= FED.montantBaseSeuilReduction) return FED.montantBase;
  if (revenuNet >= FED.montantBaseSeuilMin) return FED.montantBaseMin;
  const etendue = FED.montantBaseSeuilMin - FED.montantBaseSeuilReduction;
  return FED.montantBase - (revenuNet - FED.montantBaseSeuilReduction) * ((FED.montantBase - FED.montantBaseMin) / etendue);
}

/**
 * Calcule une paie complète pour une période.
 *
 * `salaireBrutPeriode` : tout le brut de la période, gratification comprise.
 * `dejaVerseAnnee` : cumuls de l'année AVANT cette paie, pour respecter les
 *   maximums annuels — { rrq, rrq2, rqap, rqapEmployeur, ae }, `gains` (brut
 *   cumulé, pour la 2e cotisation supplémentaire au RRQ), `boni`
 *   (gratifications déjà versées) et `csbBoni` (cotisations supplémentaires
 *   au RRQ déjà déduites sur ces gratifications). Tous à 0 par défaut.
 * `annee` : année du versement, qui choisit la table de taux.
 * `options` :
 *   - `boni` : part du brut qui est une gratification, un paiement rétroactif
 *     ou un autre forfaitaire — imposée à part (méthode des gratifications),
 *     sans être annualisée comme un salaire qui reviendrait à chaque paie ;
 *   - `montantTd1` : « montant total de la demande » du TD1 fédéral (vide =
 *     montant personnel de base) ;
 *   - `montantTp10153` : crédits personnels du TP-1015.3 (vide = montant de base) ;
 *   - `deductionsPeriode` : cotisations déductibles retenues sur la paie
 *     (REER, RPA…), et `deductionsBoni` : la part qui se rapporte au boni ;
 *   - `retenueSupFederal`, `retenueSupQuebec` : impôt additionnel demandé
 *     par l'employé, par période.
 */
function calculerPaie(salaireBrutPeriode, frequencePaie, dejaVerseAnnee = {}, annee = anneeQuebec(new Date()), options = {}) {
  dejaVerseAnnee = { rrq: 0, rrq2: 0, rqap: 0, rqapEmployeur: 0, ae: 0, gains: 0, boni: 0, csbBoni: 0, ...dejaVerseAnnee };
  const { RRQ, RQAP, AE, QC, FED, anneeTaux, tauxAJour } = tauxPourAnnee(annee);
  const P = PERIODES_PAR_AN[frequencePaie] || 26;

  const brut = Math.max(0, Number(salaireBrutPeriode) || 0);
  const boni = Math.min(brut, Math.max(0, Number(options.boni) || 0)); // B2
  const regulier = brut - boni; // G (et D)
  const deductionsBoni = Math.min(boni, Math.max(0, Number(options.deductionsBoni) || 0));
  const deductionsRegulier = Math.max(0, (Number(options.deductionsPeriode) || 0) - deductionsBoni); // F
  const boniImposable = boni - deductionsBoni;
  const boniAnterieur = Math.max(0, dejaVerseAnnee.boni); // B1

  // --- RRQ (TP-1015.F, partie 3.1) ---
  // C = le moins élevé de : maximum annuel – déjà retenu ; taux × (salaire – exemption de la période).
  // L'exemption par période garde deux décimales, sans arrondir.
  const exemptionPeriode = Math.floor((RRQ.exemptionGenerale / P) * 100) / 100;
  const rrqEmploye = arrondirCotisation(Math.min(RRQ.maxEmploye - dejaVerseAnnee.rrq, RRQ.tauxBase * (brut - exemptionPeriode)));

  // C2 = le moins élevé de : maximum – déjà retenu ; 4 % × (cumul + salaire – W),
  // W = le plus élevé du salaire cumulé et du maximum des gains admissibles
  const W = Math.max(dejaVerseAnnee.gains, RRQ.maxGainsAdmissibles);
  const rrq2Employe = arrondirCotisation(Math.min(RRQ.maxEmployeSupplementaire2 - dejaVerseAnnee.rrq2, RRQ.tauxSupplementaire2 * (dejaVerseAnnee.gains + brut - W)));

  // --- RQAP (partie 4) ---
  const rqapEmploye = arrondirCotisation(Math.min(RQAP.maxEmploye - dejaVerseAnnee.rqap, RQAP.tauxEmploye * brut));
  const rqapEmployeur = Math.max(0, arrondir(Math.min(RQAP.maxEmployeur - dejaVerseAnnee.rqapEmployeur, RQAP.tauxEmployeur * brut)));

  // --- Assurance-emploi ---
  const aeEmploye = arrondirCotisation(Math.min(AE.maxEmploye - dejaVerseAnnee.ae, AE.tauxEmploye * brut));

  // --- Cotisations supplémentaires au RRQ : déductibles du revenu ---
  // CS = C × (1 % ÷ taux de cotisation) + C2, répartie entre le salaire
  // régulier (CSA) et la gratification (CSB) au prorata
  const CS = rrqEmploye * (RRQ.tauxPremiereSupplementaire / RRQ.tauxBase) + rrq2Employe;
  const CSA = brut > 0 ? arrondir(CS * (regulier / brut)) : 0;
  const CSB = brut > 0 ? arrondir(CS * (boni / brut)) : 0;

  // ===== Impôt du Québec (TP-1015.F, partie 2.1) =====
  // Étape 1 : I = P × (G – F – H – CSA), H = déduction pour travailleur
  const H = arrondir(Math.min(QC.deductionTravailleurTaux * regulier, QC.deductionTravailleurMax / P));
  const revenuQcRegulier = Math.max(0, P * arrondir(regulier - deductionsRegulier - H - CSA));
  // Étape 2 : Y = (T × I) – K – (14 % × E) ; étape 3 : A = Y ÷ P + L
  const E = Math.round(options.montantTp10153 ?? QC.montantBase);
  const impotQcAnneeRegulier = Math.max(0, impotAnnuel(revenuQcRegulier, QC.paliers) - QC.tauxCredit * E);
  let impotQuebec = Math.max(0, impotQcAnneeRegulier / P + (Number(options.retenueSupQuebec) || 0));

  // Gratification (partie 2.1.2, seconde méthode) : le taux est celui du
  // revenu annuel, gratifications de l'année comprises, appliqué à (B2 – CSB).
  // Salaire annuel + forfaitaire sous le seuil : retenue fixe sur le forfaitaire.
  let impotQuebecBoni = 0;
  if (boni > 0) {
    if (P * regulier + boni <= QC.seuilGratification) {
      impotQuebecBoni = QC.tauxGratificationSousSeuil * boniImposable;
    } else {
      const revenuAvecBoni = Math.max(0, revenuQcRegulier + boniAnterieur + boniImposable - dejaVerseAnnee.csbBoni - CSB);
      impotQuebecBoni = Math.max(0, palierPour(revenuAvecBoni, QC.paliers).taux * (boniImposable - CSB));
    }
  }
  impotQuebec += impotQuebecBoni;

  // ===== Impôt fédéral (T4127, option 1, employé du Québec) =====
  // K2Q : crédits pour les cotisations de BASE au RRQ, à l'AE et au RQAP,
  // annualisées et plafonnées au maximum de l'année. Maximum déjà atteint
  // (ou atteint à cette paie) : on prend le maximum pour le reste de l'année.
  const maxRrqBase = (RRQ.maxGainsAdmissibles - RRQ.exemptionGenerale) * RRQ.tauxBaseSeul;
  const atteint = (cumul, periode, max) => cumul + periode >= max - 0.005;
  const creditRrq = atteint(dejaVerseAnnee.rrq, rrqEmploye, RRQ.maxEmploye) ? maxRrqBase : Math.min(P * rrqEmploye * (RRQ.tauxBaseSeul / RRQ.tauxBase), maxRrqBase);
  const creditAe = atteint(dejaVerseAnnee.ae, aeEmploye, AE.maxEmploye) ? AE.maxEmploye : Math.min(P * aeEmploye, AE.maxEmploye);
  const creditRqap = atteint(dejaVerseAnnee.rqap, rqapEmploye, RQAP.maxEmploye) ? RQAP.maxEmploye : Math.min(P * rqapEmploye, RQAP.maxEmploye);
  const K2Q = FED.tauxCredit * (creditRrq + creditAe + creditRqap);

  // T3 = (R × A) – K – K1 – K2Q – K4 ; T1 = T3 – (abattement du Québec × T3)
  const impotFederalAnnuel = (A) => {
    if (!(A > 0)) return 0;
    const TC = options.montantTd1 ?? montantBaseFederal(A, FED);
    const K1 = FED.tauxCredit * TC;
    const K4 = Math.min(FED.tauxCredit * A, FED.tauxCredit * FED.montantEmploi);
    const T3 = Math.max(0, impotAnnuel(A, FED.paliers) - K1 - K2Q - K4);
    return T3 * (1 - FED.abattementQuebec);
  };
  // A = P × (I – F – F5A) : F5A = cotisations supplémentaires au RRQ sur le salaire régulier
  const revenuFedRegulier = Math.max(0, P * (regulier - deductionsRegulier - CSA));
  let impotFederal = Math.max(0, impotFederalAnnuel(revenuFedRegulier) / P + (Number(options.retenueSupFederal) || 0));

  // Prime : impôt de l'année avec la prime, moins l'impôt de l'année sans elle
  // (les primes déjà versées dans l'année comptent dans les deux calculs)
  let impotFederalBoni = 0;
  if (boni > 0) {
    const avantPrime = revenuFedRegulier + boniAnterieur - dejaVerseAnnee.csbBoni;
    impotFederalBoni = Math.max(0, impotFederalAnnuel(avantPrime + boniImposable - CSB) - impotFederalAnnuel(avantPrime));
  }
  impotFederal += impotFederalBoni;

  impotQuebec = arrondir(impotQuebec);
  impotFederal = arrondir(impotFederal);

  const totalDeductions = arrondir(rrqEmploye + rrq2Employe + rqapEmploye + aeEmploye + impotFederal + impotQuebec);
  const salaireNet = arrondir(brut - totalDeductions);

  return {
    salaireBrutPeriode: arrondir(brut),
    rrqEmploye,
    rrq2Employe,
    rqapEmploye,
    aeEmploye,
    impotFederal,
    impotQuebec,
    totalDeductions,
    salaireNet,
    // Part employeur : RRQ égal à celui de l'employé (partie 3.2), AE à 1,4 fois
    rrqEmployeur: rrqEmploye,
    rrq2Employeur: rrq2Employe,
    rqapEmployeur,
    aeEmployeur: arrondir(aeEmploye * (AE.tauxEmployeur / AE.tauxEmploye)),
    // Détail, pour les tests et le diagnostic
    detail: { H, CSA, CSB, revenuQcRegulier, impotQuebecBoni: arrondir(impotQuebecBoni), revenuFedRegulier, impotFederalBoni: arrondir(impotFederalBoni), K2Q: arrondir(K2Q) },
    anneeTaux,
    tauxAJour,
  };
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
  // Gratifications déjà versées (B1) et cotisations supplémentaires au RRQ
  // déjà déduites sur elles (CSB1) : recalculées à partir de chaque paie,
  // au prorata du boni dans le brut — comme au moment de la paie.
  const { RRQ } = tauxPourAnnee(annee);
  const dejaVerseAnnee = paiesAnnee.reduce(
    (acc, p) => {
      const cs = p.rrqEmploye * (RRQ.tauxPremiereSupplementaire / RRQ.tauxBase) + p.rrq2Employe;
      return {
        rrq: acc.rrq + p.rrqEmploye, rrq2: acc.rrq2 + p.rrq2Employe, rqap: acc.rqap + p.rqapEmploye,
        rqapEmployeur: acc.rqapEmployeur + p.rqapEmployeur, ae: acc.ae + p.aeEmploye, gains: acc.gains + p.salaireBrut,
        boni: acc.boni + (p.boni || 0),
        csbBoni: acc.csbBoni + (p.boni > 0 && p.salaireBrut > 0 ? cs * (p.boni / p.salaireBrut) : 0),
      };
    },
    { rrq: 0, rrq2: 0, rqap: 0, rqapEmployeur: 0, ae: 0, gains: 0, boni: 0, csbBoni: 0 }
  );

  const resultat = calculerPaie(salaireBrutPeriode, employe.frequencePaie, dejaVerseAnnee, annee, {
    boni: boniFinal,
    // Montants déclarés par l'employé (TD1 et TP-1015.3) ; vides = montants de base de l'année
    montantTd1: employe.montantTd1 ?? undefined,
    montantTp10153: employe.montantTp10153 ?? undefined,
  });
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
