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
//   la 123e édition (juillet 2026) ; formules (revenu imposable, K2Q, MPBF,
//   K4, primes, assurance-emploi) de la 122e édition (janvier 2026), dont
//   l'exemple de calcul d'une prime sert aussi de test.
//
// ⚠️ Ce logiciel n'est pas certifié par Revenu Québec ni par l'ARC. Cas non
// couverts : commissions, avantages imposables (part de l'employeur d'une
// assurance collective), cotisations syndicales, fonds de travailleurs,
// déductions autorisées (TP-1016). Dans ces cas, valider avec WebRAS :
// https://www.revenuquebec.ca/fr/services-en-ligne/outils/webras/
// ============================================================

const { prisma } = require("./prisma");
const { joursCalendairesQuebec, dateQuebecStr, limitesMoisQuebec, limitesJourQuebec } = require("./temps");
const { calculerHeuresPeriode, MAJORATION_HEURES_SUP } = require("./heuresPaie");
const { joursFeriesEntre } = require("./joursFeries");
const { retenuesPourPaie } = require("./retenuesPaie");

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
    // Cotisations de l'employeur seulement
    // FSS — TP-1015.F, partie 5 : taux selon la masse salariale totale et le
    // secteur ; sert de valeur par défaut au réglage « paie_fss_taux »
    FSS: { tauxParDefaut: 1.65, tauxPrimaireManufacturier: 1.25, tauxMax: 4.26 }, // en %
    // Normes du travail : 0,06 % de la rémunération assujettie, jusqu'au
    // maximum par employé (le même que le maximum assurable de la CNESST)
    CNT: { taux: 0.0006, maxAssujetti: 103000 },
    // CNESST : le taux ($ par 100 $ de salaire assurable) est propre à
    // chaque employeur — réglage « paie_cnesst_taux » ; seul le maximum
    // assurable par employé est commun
    CNESST: { maxAssurable: 103000 },
    // Assurance-emploi, employés du Québec (T4127, chapitre 7)
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
      seuilPrimeFixe: 5000, // revenu annuel avec la prime à ce seuil ou moins : retenue fixe sur la prime
      tauxPrimeFixe: 0.10, // 10 % au Québec (15 % ailleurs)
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
 *   - `retenuesApresImpot` : autres retenues propres à l'employé (assurance
 *     collective…), qui ne changent aucun calcul et réduisent le net ;
 *   - `retenueSupFederal`, `retenueSupQuebec` : impôt additionnel demandé
 *     par l'employé, par période ;
 *   - `tauxFss` : taux de cotisation de l'employeur au FSS, en % (vide =
 *     taux par défaut de l'année) ;
 *   - `tauxCnesst` : taux de la CNESST de l'employeur, en $ par 100 $ de
 *     salaire assurable (vide = prime non calculée) ;
 *   - `salaireReference` : pour un forfaitaire versé À PART du salaire
 *     (toute la paie est un `boni` — ex. des vacances versées en plus du
 *     salaire), le salaire régulier d'une période de l'employé. Il sert à
 *     estimer son revenu annuel, donc le taux d'impôt du forfaitaire ; aucun
 *     impôt « régulier » n'est retenu sur cette paie, et l'exemption du RRQ
 *     de la période, déjà accordée sur le salaire, ne s'applique pas ;
 *   - exemptions (voir exemptionsEmploye) : `exempteAE` (emploi non
 *     assurable), `exempteRRQ` (aucune cotisation au RRQ sur cette paie),
 *     `moisRRQ` (nombre de mois cotisables au RRQ dans l'année, la variable
 *     PM des guides — 12 par défaut), `exempteCNESST` (dirigeant non couvert).
 */
function calculerPaie(salaireBrutPeriode, frequencePaie, dejaVerseAnnee = {}, annee = anneeQuebec(new Date()), options = {}) {
  dejaVerseAnnee = { rrq: 0, rrq2: 0, rqap: 0, rqapEmployeur: 0, ae: 0, gains: 0, boni: 0, csbBoni: 0, ...dejaVerseAnnee };
  // `options.table` : table de taux imposée, pour les tests seulement
  const { RRQ, RQAP, AE, QC, FED, FSS, CNT, CNESST, anneeTaux, tauxAJour } = options.table || tauxPourAnnee(annee);
  const P = PERIODES_PAR_AN[frequencePaie] || 26;

  const brut = Math.max(0, Number(salaireBrutPeriode) || 0);
  const boni = Math.min(brut, Math.max(0, Number(options.boni) || 0)); // B2
  const regulier = brut - boni; // G (et D)
  const deductionsBoni = Math.min(boni, Math.max(0, Number(options.deductionsBoni) || 0));
  const deductionsRegulier = Math.max(0, (Number(options.deductionsPeriode) || 0) - deductionsBoni); // F
  const boniImposable = boni - deductionsBoni;
  const boniAnterieur = Math.max(0, dejaVerseAnnee.boni); // B1
  // Forfaitaire versé à part du salaire : G vient du salaire de référence
  const aPart = regulier <= 0 && boni > 0 && options.salaireReference !== undefined;
  const G = aPart ? Math.max(0, Number(options.salaireReference) || 0) : regulier;

  // --- Exemptions ---
  // PM : mois de l'année où l'employé doit cotiser au RRQ ; les maximums
  // annuels sont au prorata (PM ÷ 12). 0 = aucune cotisation dans l'année.
  const PM = Math.max(0, Math.min(12, options.moisRRQ ?? 12));
  const cotiseRrq = !options.exempteRRQ && PM > 0;
  const cotiseAe = !options.exempteAE;

  // --- RRQ (TP-1015.F, partie 3.1) ---
  // C = le moins élevé de : maximum annuel × (PM ÷ 12) – déjà retenu ; taux × (salaire – exemption de la période).
  // L'exemption par période garde deux décimales, sans arrondir.
  const exemptionPeriode = Math.floor((RRQ.exemptionGenerale / P) * 100) / 100;
  const maxRrqAnnee = RRQ.maxEmploye * (PM / 12);
  // Forfaitaire versé à part : l'exemption de la période a déjà été accordée sur le salaire
  const rrqEmploye = cotiseRrq ? arrondirCotisation(Math.min(maxRrqAnnee - dejaVerseAnnee.rrq, RRQ.tauxBase * (brut - (aPart ? 0 : exemptionPeriode)))) : 0;
  // Cotisations d'une période de salaire régulier (G) : celles de cette paie,
  // ou, pour un forfaitaire versé à part, celles que donnerait le salaire de référence
  const cotisationSur = (cotise, taux, base) => (cotise ? arrondirCotisation(taux * base) : 0);
  const rrqRegulier = aPart ? cotisationSur(cotiseRrq, RRQ.tauxBase, G - exemptionPeriode) : Math.min(rrqEmploye, cotisationSur(cotiseRrq, RRQ.tauxBase, regulier - exemptionPeriode));

  // C2 = le moins élevé de : maximum × (PM ÷ 12) – déjà retenu ; 4 % × (cumul + salaire – W),
  // W = le plus élevé du salaire cumulé et du maximum des gains admissibles × (PM ÷ 12)
  const W = Math.max(dejaVerseAnnee.gains, RRQ.maxGainsAdmissibles * (PM / 12));
  const rrq2Employe = cotiseRrq
    ? arrondirCotisation(Math.min(RRQ.maxEmployeSupplementaire2 * (PM / 12) - dejaVerseAnnee.rrq2, RRQ.tauxSupplementaire2 * (dejaVerseAnnee.gains + brut - W)))
    : 0;

  // --- RQAP (partie 4) ---
  const rqapEmploye = arrondirCotisation(Math.min(RQAP.maxEmploye - dejaVerseAnnee.rqap, RQAP.tauxEmploye * brut));
  const rqapEmployeur = Math.max(0, arrondir(Math.min(RQAP.maxEmployeur - dejaVerseAnnee.rqapEmployeur, RQAP.tauxEmployeur * brut)));

  // --- Assurance-emploi ---
  const aeEmploye = cotiseAe ? arrondirCotisation(Math.min(AE.maxEmploye - dejaVerseAnnee.ae, AE.tauxEmploye * brut)) : 0;

  // --- Cotisations de l'employeur seulement : FSS, normes du travail, CNESST ---
  // FSS (TP-1015.F, partie 5) : taux × salaires de la période, sans maximum.
  // Normes du travail et CNESST : jusqu'au maximum annuel par employé.
  const tauxFss = options.tauxFss ?? FSS?.tauxParDefaut ?? 0;
  const fssEmployeur = arrondir(brut * (tauxFss / 100));
  const sousMaximum = (max) => Math.max(0, Math.min(brut, (max ?? 0) - dejaVerseAnnee.gains));
  const cntEmployeur = CNT ? arrondir(CNT.taux * sousMaximum(CNT.maxAssujetti)) : 0;
  const cnesstEmployeur = CNESST && !options.exempteCNESST ? arrondir(((Number(options.tauxCnesst) || 0) / 100) * sousMaximum(CNESST.maxAssurable)) : 0;

  // --- Cotisations supplémentaires au RRQ : déductibles du revenu ---
  // CS = C × (1 % ÷ taux de cotisation) + C2, répartie entre le salaire
  // régulier (CSA) et la gratification (CSB) au prorata
  const CS = rrqEmploye * (RRQ.tauxPremiereSupplementaire / RRQ.tauxBase) + rrq2Employe;
  const CSA = aPart ? arrondir(rrqRegulier * (RRQ.tauxPremiereSupplementaire / RRQ.tauxBase)) : brut > 0 ? arrondir(CS * (regulier / brut)) : 0;
  const CSB = aPart ? arrondir(CS) : brut > 0 ? arrondir(CS * (boni / brut)) : 0;

  // ===== Impôt du Québec (TP-1015.F, partie 2.1) =====
  // Étape 1 : I = P × (G – F – H – CSA), H = déduction pour travailleur
  const H = arrondir(Math.min(QC.deductionTravailleurTaux * G, QC.deductionTravailleurMax / P));
  const revenuQcRegulier = Math.max(0, P * arrondir(G - deductionsRegulier - H - CSA));
  // Étape 2 : Y = (T × I) – K – (14 % × E) ; étape 3 : A = Y ÷ P + L
  const E = Math.round(options.montantTp10153 ?? QC.montantBase);
  const impotQcAnneeRegulier = Math.max(0, impotAnnuel(revenuQcRegulier, QC.paliers) - QC.tauxCredit * E);
  // (forfaitaire versé à part : l'impôt du salaire est retenu sur la paie régulière, pas ici)
  let impotQuebec = aPart ? 0 : Math.max(0, impotQcAnneeRegulier / P + (Number(options.retenueSupQuebec) || 0));

  // Gratification (partie 2.1.2, seconde méthode) : le taux est celui du
  // revenu annuel, gratifications de l'année comprises, appliqué à (B2 – CSB).
  // Salaire annuel + forfaitaire sous le seuil : retenue fixe sur le forfaitaire.
  let impotQuebecBoni = 0;
  if (boni > 0) {
    if (P * G + boni <= QC.seuilGratification) {
      impotQuebecBoni = QC.tauxGratificationSousSeuil * boniImposable;
    } else {
      const revenuAvecBoni = Math.max(0, revenuQcRegulier + boniAnterieur + boniImposable - dejaVerseAnnee.csbBoni - CSB);
      impotQuebecBoni = Math.max(0, palierPour(revenuAvecBoni, QC.paliers).taux * (boniImposable - CSB));
    }
  }
  impotQuebec += impotQuebecBoni;

  // ===== Impôt fédéral (T4127, 122e édition, option 1, employé du Québec) =====
  // Part des cotisations de la période qui vient du salaire régulier ; le
  // reste vient de la prime (le guide les traite séparément dans K2Q)
  const aeRegulier = aPart ? cotisationSur(cotiseAe, AE.tauxEmploye, G) : Math.min(aeEmploye, arrondirCotisation(AE.tauxEmploye * regulier));
  const rqapRegulier = aPart ? cotisationSur(true, RQAP.tauxEmploye, G) : Math.min(rqapEmploye, arrondirCotisation(RQAP.tauxEmploye * regulier));
  // Part des cotisations de cette paie qui vient de la prime
  const rrqPrime = aPart ? rrqEmploye : rrqEmploye - rrqRegulier;
  const aePrime = aPart ? aeEmploye : aeEmploye - aeRegulier;
  const rqapPrime = aPart ? rqapEmploye : rqapEmploye - rqapRegulier;
  const ratioBase = RRQ.tauxBaseSeul / RRQ.tauxBase;
  const maxRrqBase = (RRQ.maxGainsAdmissibles - RRQ.exemptionGenerale) * RRQ.tauxBaseSeul * (PM / 12);
  const atteint = (cumul, periode, max) => cumul + periode >= max - 0.005;

  // K2Q = taux × [cotisations de BASE au RRQ + AE + RQAP], annualisées et
  // plafonnées au maximum de l'année. Maximum atteint (déjà, ou à cette
  // paie) : on prend le maximum pour le reste de l'année, comme le guide
  // le recommande. `primes` : 0 = salaire régulier seul ; 1 = avec les
  // primes déjà versées dans l'année ; 2 = avec aussi la prime courante.
  const K2Q = (primes) => {
    const anterieur = primes >= 1 ? boniAnterieur : 0;
    const courant = primes >= 2 ? 1 : 0;
    // Employé exempté : aucune cotisation, donc aucun crédit
    const rrq = !cotiseRrq ? 0 : atteint(dejaVerseAnnee.rrq, rrqEmploye, maxRrqAnnee)
      ? maxRrqBase
      : Math.min(P * rrqRegulier * ratioBase + courant * rrqPrime * ratioBase + RRQ.tauxBaseSeul * anterieur, maxRrqBase);
    const ae = !cotiseAe ? 0 : atteint(dejaVerseAnnee.ae, aeEmploye, AE.maxEmploye)
      ? AE.maxEmploye
      : Math.min(P * aeRegulier + courant * aePrime + AE.tauxEmploye * anterieur, AE.maxEmploye);
    const rqap = atteint(dejaVerseAnnee.rqap, rqapEmploye, RQAP.maxEmploye)
      ? RQAP.maxEmploye
      : Math.min(P * rqapRegulier + courant * rqapPrime + RQAP.tauxEmploye * anterieur, RQAP.maxEmploye);
    return FED.tauxCredit * (rrq + ae + rqap);
  };

  // T3 = (R × A) – K – K1 – K2Q – K4 ; T1 = T3 – (abattement du Québec × T3).
  // K4 se calcule sur le revenu d'emploi brut de l'année, avant déductions.
  const impotFederalAnnuel = (A, brutAnnuel, primes) => {
    if (!(A > 0)) return 0;
    const TC = options.montantTd1 ?? arrondir(montantBaseFederal(A, FED));
    const K1 = FED.tauxCredit * TC;
    const K4 = Math.min(FED.tauxCredit * brutAnnuel, FED.tauxCredit * FED.montantEmploi);
    const T3 = Math.max(0, impotAnnuel(A, FED.paliers) - K1 - K2Q(primes) - K4);
    return T3 * (1 - FED.abattementQuebec);
  };
  // Étape 1 : A = P × (I – F – F5A), F5A = cotisations supplémentaires au RRQ sur le salaire régulier
  const revenuFedRegulier = Math.max(0, P * (G - deductionsRegulier - CSA));
  // Étape 6 : T = (T1 ÷ P) + L
  let impotFederal = aPart ? 0 : Math.max(0, impotFederalAnnuel(revenuFedRegulier, P * G, 0) / P + (Number(options.retenueSupFederal) || 0));

  // Prime : impôt de l'année avec la prime (étape 1), moins l'impôt de
  // l'année sans elle (étape 2) ; les primes déjà versées comptent dans les
  // deux. Revenu annuel avec la prime sous le seuil : retenue fixe.
  let impotFederalBoni = 0;
  if (boni > 0) {
    const primesAnterieures = Math.max(0, boniAnterieur - dejaVerseAnnee.csbBoni);
    const sansPrime = revenuFedRegulier + primesAnterieures;
    const avecPrime = sansPrime + Math.max(0, boniImposable - CSB);
    if (avecPrime <= FED.seuilPrimeFixe) {
      impotFederalBoni = FED.tauxPrimeFixe * boni;
    } else {
      const brutAnnuel = P * G + boniAnterieur;
      impotFederalBoni = Math.max(0, arrondir(impotFederalAnnuel(avecPrime, brutAnnuel + boni, 2)) - arrondir(impotFederalAnnuel(sansPrime, brutAnnuel, 1)));
    }
  }
  impotFederal += impotFederalBoni;

  impotQuebec = arrondir(impotQuebec);
  impotFederal = arrondir(impotFederal);

  // Retenues propres à l'employé : le REER (déjà déduit du revenu imposable
  // plus haut) et les retenues après impôt sortent aussi du net
  const retenuesDeductibles = arrondir(Math.max(0, Number(options.deductionsPeriode) || 0));
  const retenuesApresImpot = arrondir(Math.max(0, Number(options.retenuesApresImpot) || 0));
  const totalDeductions = arrondir(rrqEmploye + rrq2Employe + rqapEmploye + aeEmploye + impotFederal + impotQuebec + retenuesDeductibles + retenuesApresImpot);
  const salaireNet = arrondir(brut - totalDeductions);

  return {
    salaireBrutPeriode: arrondir(brut),
    rrqEmploye,
    rrq2Employe,
    rqapEmploye,
    aeEmploye,
    impotFederal,
    impotQuebec,
    retenuesDeductibles,
    retenuesApresImpot,
    totalDeductions,
    salaireNet,
    // Part employeur : RRQ égal à celui de l'employé (partie 3.2), AE à 1,4 fois
    rrqEmployeur: rrqEmploye,
    rrq2Employeur: rrq2Employe,
    rqapEmployeur,
    aeEmployeur: arrondir(aeEmploye * (AE.tauxEmployeur / AE.tauxEmploye)),
    fssEmployeur,
    cntEmployeur,
    cnesstEmployeur,
    // Détail, pour les tests et le diagnostic
    detail: { H, CSA, CSB, revenuQcRegulier, impotQuebecBoni: arrondir(impotQuebecBoni), revenuFedRegulier, impotFederalBoni: arrondir(impotFederalBoni), K2Q: arrondir(K2Q(0)) },
    anneeTaux,
    tauxAJour,
  };
}


// Exemptions d'un employé pour une paie versée à une date donnée :
// - RRQ selon l'âge (date de naissance de la fiche) : aucune cotisation
//   avant ou pendant le mois du 18e anniversaire, ni à partir de l'année
//   où l'employé a 73 ans au 31 décembre. L'année des 18 ans, les maximums
//   sont au prorata des mois qui suivent l'anniversaire (variable PM).
// - RRQ, choix de l'employé : à 65 ans ou plus, avec une rente de retraite,
//   il peut cesser de cotiser (formulaire RR-50) — case de la fiche.
// - Assurance-emploi : emploi non assurable (propriétaire qui contrôle plus
//   de 40 % des actions votantes, lien de dépendance) — case de la fiche.
// - CNESST : dirigeant non couvert sans protection personnelle — case de la fiche.
// Retourne les options à passer à calculerPaie et les raisons, pour l'affichage.
function exemptionsEmploye(employe, dateVersement) {
  const raisons = [];
  let exempteRRQ = false;
  let moisRRQ = 12;
  if (employe.dateNaissance) {
    const naissance = new Date(employe.dateNaissance).toISOString().slice(0, 10); // journée civile, ancrée à midi UTC
    const [anNaissance, moisNaissance] = naissance.split("-").map(Number);
    const [annee, mois] = dateQuebecStr(dateVersement).split("-").map(Number);
    const ageFinAnnee = annee - anNaissance;
    if (ageFinAnnee < 18) {
      exempteRRQ = true;
      moisRRQ = 0;
      raisons.push("RRQ : moins de 18 ans");
    } else if (ageFinAnnee === 18) {
      moisRRQ = 12 - moisNaissance;
      if (mois <= moisNaissance) {
        exempteRRQ = true;
        raisons.push("RRQ : avant la fin du mois de ses 18 ans");
      }
    } else if (ageFinAnnee >= 73) {
      exempteRRQ = true;
      moisRRQ = 0;
      raisons.push("RRQ : 73 ans ou plus à la fin de l'année");
    }
  }
  if (employe.exemptionRRQ && !exempteRRQ) {
    exempteRRQ = true;
    raisons.push("RRQ : a choisi de cesser de cotiser");
  }
  if (employe.exemptionAE) raisons.push("Assurance-emploi : emploi non assurable");
  if (employe.exemptionCNESST) raisons.push("CNESST : dirigeant non couvert");
  return { exempteRRQ, moisRRQ, exempteAE: !!employe.exemptionAE, exempteCNESST: !!employe.exemptionCNESST, raisons };
}

// Taux de l'employeur réglés dans l'appli (page Paie → Cotisations de
// l'employeur) : FSS en %, CNESST en $ par 100 $. null = pas réglé.
// Congé de Pâques choisi par l'employeur : "VENDREDI" (saint, par défaut) ou "LUNDI" (de Pâques)
const CLE_CONGE_PAQUES = "paie_ferie_paques";
const CLES_TAUX_EMPLOYEUR = { fss: "paie_fss_taux", cnesst: "paie_cnesst_taux" };
async function lireTauxEmployeur() {
  const parametres = await prisma.parametre.findMany({ where: { cle: { in: Object.values(CLES_TAUX_EMPLOYEUR) } } });
  const lire = (cle) => {
    const valeur = parametres.find((p) => p.cle === cle)?.valeur;
    return valeur === undefined || valeur === "" || !(Number(valeur) >= 0) ? null : Number(valeur);
  };
  return { fss: lire(CLES_TAUX_EMPLOYEUR.fss), cnesst: lire(CLES_TAUX_EMPLOYEUR.cnesst) };
}

// Colonnes de calcul d'une paie (modèle Paie), tirées d'un résultat de
// calculerPaiePourEmploye — une seule liste pour toutes les routes
function champsCalculPaie(r) {
  return {
    heuresTravaillees: r.heuresTravaillees, heuresHorodateur: r.heuresHorodateur, boni: r.boni,
    heuresSupplementaires: r.heuresSupplementaires, indemniteFeries: r.indemniteFeries,
    salaireBrut: r.salaireBrutPeriode,
    rrqEmploye: r.rrqEmploye, rrq2Employe: r.rrq2Employe, rqapEmploye: r.rqapEmploye, aeEmploye: r.aeEmploye,
    impotFederal: r.impotFederal, impotQuebec: r.impotQuebec, totalDeductions: r.totalDeductions, salaireNet: r.salaireNet,
    rrqEmployeur: r.rrqEmployeur, rrq2Employeur: r.rrq2Employeur, rqapEmployeur: r.rqapEmployeur, aeEmployeur: r.aeEmployeur,
    fssEmployeur: r.fssEmployeur, cntEmployeur: r.cntEmployeur, cnesstEmployeur: r.cnesstEmployeur,
    vacancesAccumulees: r.vacancesAccumulees,
    vacancesForfaitaire: !!r.vacancesForfaitaire,
    retenuesDeductibles: r.retenuesDeductibles || 0, retenuesApresImpot: r.retenuesApresImpot || 0,
    retenuesDetail: r.retenuesDetail || [],
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

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}

// Calcule la paie d'UN employé pour une période — logique partagée entre
// l'ancien endpoint ponctuel (app/api/paie/calculer/route.js) et le
// traitement par lot (app/api/paie/lots/route.js), pour ne jamais diverger.
// Retourne { erreur } si l'employé est introuvable ou les dates invalides.
// `dateVersement` (à défaut, la fin de la période) fixe l'année des taux et
// des maximums annuels — la même règle que les feuillets (lib/feuilletsFiscaux.js).
// `heuresManuelles`, `heuresSupManuelles` et `indemniteFeriesManuelle`
// remplacent les heures régulières, les heures supplémentaires et
// l'indemnité des jours fériés calculées (ajustement d'une paie dans le lot).
// `vacancesForfaitaire` (paie de vacances seulement) : les vacances sont
// versées EN PLUS du salaire, sans congé pris — un paiement forfaitaire,
// imposé par la méthode des gratifications. Sinon, la paie de vacances
// remplace le salaire de la période et s'impose comme une paie ordinaire.
async function calculerPaiePourEmploye(employeId, { periodeDebut, periodeFin, dateVersement, typePaie, heuresManuelles, heuresSupManuelles, indemniteFeriesManuelle, montantVacances, vacancesForfaitaire, boni } = {}) {
  const employe = await prisma.user.findUnique({ where: { id: employeId } });
  if (!employe) return { erreur: "Employé introuvable." };

  // La période est faite de journées civiles du Québec, bornes incluses :
  // on en tire les dates « AAAA-MM-JJ », puis les vrais instants de début et
  // de fin, peu importe la forme reçue (texte du formulaire, ou date du lot
  // ancrée à midi UTC).
  const jourCivilStr = (v) => (v instanceof Date ? v.toISOString() : String(v || "")).slice(0, 10);
  const debutStr = jourCivilStr(periodeDebut);
  const finStr = jourCivilStr(periodeFin);
  const formatDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!formatDate.test(debutStr) || !formatDate.test(finStr) || finStr < debutStr) return { erreur: "Période invalide." };
  const debut = limitesJourQuebec(debutStr).debut;
  const fin = limitesJourQuebec(finStr).fin;

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
  let heuresSupplementaires = 0;
  let indemniteFeries = 0;
  let feries = [];
  let salaireBrutPeriode = 0;
  const saisi = (v) => v !== undefined && v !== null && v !== "";

  if (typePaie === "VACANCES") {
    salaireBrutPeriode = saisi(montantVacances) ? Number(montantVacances) : soldeVacances;
  } else if (employe.typeRemuneration === "SALAIRE") {
    // Salaire fixe : ni heures supplémentaires ni indemnité de jour férié calculées
    const periodesParAn = PERIODES_PAR_AN[employe.frequencePaie] || 26;
    salaireBrutPeriode = (employe.salaireAnnuel || 0) / periodesParAn;
  } else {
    // Poinçons depuis 6 semaines avant la période : une semaine à cheval sur
    // deux périodes se règle en entier, et l'indemnité d'un jour férié se
    // calcule sur les 4 semaines qui précèdent sa semaine
    const depuis = new Date(debut.getTime() - 42 * 86400000);
    const [entreesBons, entreesInternes, parametres, horaireFinal] = await Promise.all([
      prisma.entreeTemps.findMany({ where: { employeId, fin: { not: null }, debut: { gte: depuis, lte: fin } } }),
      prisma.entreeTempsInterne.findMany({ where: { employeId, fin: { not: null }, debut: { gte: depuis, lte: fin } } }),
      prisma.parametre.findMany({ where: { cle: { in: ["cout_horaire_mecanicien", CLE_CONGE_PAQUES] } } }),
      chargerHoraireOuverture(),
    ]);
    const entrees = [...entreesBons, ...entreesInternes];
    const parametre = (cle) => parametres.find((p) => p.cle === cle)?.valeur;
    heuresHorodateur = entrees.filter((e) => e.debut >= debut).reduce((s, e) => s + dureeHeures(e.debut, e.fin), 0);

    // Heures par défaut = l'horaire d'ouverture du commerce (Paramètres),
    // pas les heures réellement poinçonnées :
    // - Secrétaire, gérant, niveau 4 : toutes les heures d'ouverture
    //   prévues sur la période (peu importe le poinçon).
    // - Autres (mécanicien…) : seulement les jours où au moins un poinçon
    //   existe, chacun compté pour l'horaire prévu CE jour-là (ex. vendredi
    //   = 5h prévues) plutôt que la durée exacte poinçonnée. Le vrai total
    //   poinçonné (heuresHorodateur) reste affiché à titre indicatif.
    // Les heures réellement poinçonnées servent quand une semaine dépasse
    // 40 heures : le surplus est payé à taux et demi (lib/heuresPaie.js).
    const optionsFeries = { paques: parametre(CLE_CONGE_PAQUES) === "LUNDI" ? "LUNDI" : "VENDREDI" };
    const heures = calculerHeuresPeriode({
      entrees, debutStr, finStr, horaire: horaireFinal,
      horaireComplet: ROLES_HORAIRE_COMPLET.includes(employe.role),
      feries: joursFeriesEntre(dateQuebecStr(depuis), finStr, optionsFeries),
    });
    feries = heures.feries;

    // Taux propre à l'employé ; à défaut, le taux global des Paramètres s'il
    // a été réglé. Jamais de montant inventé : sans l'un ni l'autre, on
    // refuse de calculer plutôt que de payer un taux que personne n'a choisi.
    const taux = employe.tauxHoraireEmploye || Number(parametre("cout_horaire_mecanicien")) || 0;
    if (!(taux > 0)) {
      return { erreur: `Aucun taux horaire pour ${employe.nom} : inscris-le dans sa fiche d'employé.` };
    }

    // Chaque valeur calculée peut être remplacée à la main dans le lot
    heuresTravaillees = saisi(heuresManuelles) ? Math.max(0, Number(heuresManuelles) || 0) : heures.heuresRegulieres;
    heuresSupplementaires = saisi(heuresSupManuelles) ? Math.max(0, Number(heuresSupManuelles) || 0) : heures.heuresSupplementaires;
    indemniteFeries = saisi(indemniteFeriesManuelle)
      ? Math.max(0, Number(indemniteFeriesManuelle) || 0)
      : Math.round(heures.heuresFeries * taux * 100) / 100;
    salaireBrutPeriode = heuresTravaillees * taux + heuresSupplementaires * taux * MAJORATION_HEURES_SUP + indemniteFeries;
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
        // Des vacances versées en plus du salaire sont un forfaitaire en entier
        boni: acc.boni + (p.vacancesForfaitaire ? p.salaireBrut : p.boni || 0),
        csbBoni: acc.csbBoni + (p.vacancesForfaitaire ? cs : p.boni > 0 && p.salaireBrut > 0 ? cs * (p.boni / p.salaireBrut) : 0),
      };
    },
    { rrq: 0, rrq2: 0, rqap: 0, rqapEmployeur: 0, ae: 0, gains: 0, boni: 0, csbBoni: 0 }
  );

  // Vacances versées en plus du salaire : tout le montant est un forfaitaire,
  // et le salaire régulier d'une période sert à estimer le revenu annuel —
  // le salaire fixe du salarié, sinon sa dernière paie régulière versée.
  const forfaitaire = typePaie === "VACANCES" && !!vacancesForfaitaire;
  let salaireReference;
  if (forfaitaire) {
    if (employe.typeRemuneration === "SALAIRE") {
      salaireReference = (employe.salaireAnnuel || 0) / (PERIODES_PAR_AN[employe.frequencePaie] || 26);
    } else {
      const derniere = await prisma.paie.findFirst({ where: { employeId, statut: "VERSEE", typePaie: "REGULIERE" }, orderBy: { periodeFin: "desc" } });
      salaireReference = derniere ? Math.max(0, derniere.salaireBrut - (derniere.boni || 0)) : 0;
    }
  }

  // Retenues propres à l'employé (REER, assurance collective…) : sur une
  // paie régulière qui verse quelque chose, jamais sur une paie de vacances
  const retenues = typePaie !== "VACANCES" && salaireBrutPeriode > 0
    ? retenuesPourPaie(await prisma.retenueEmploye.findMany({ where: { employeId, actif: true }, orderBy: { creeLe: "asc" } }))
    : retenuesPourPaie([]);

  const tauxEmployeur = await lireTauxEmployeur();
  const { raisons: exemptions, ...optionsExemptions } = exemptionsEmploye(employe, dateVersement ? new Date(dateVersement) : fin);
  const resultat = calculerPaie(salaireBrutPeriode, employe.frequencePaie, dejaVerseAnnee, annee, {
    boni: forfaitaire ? salaireBrutPeriode : boniFinal,
    salaireReference,
    deductionsPeriode: retenues.deductibles,
    retenuesApresImpot: retenues.apresImpot,
    ...optionsExemptions,
    tauxFss: tauxEmployeur.fss ?? undefined,
    tauxCnesst: tauxEmployeur.cnesst ?? undefined,
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
    heuresSupplementaires,
    indemniteFeries,
    vacancesForfaitaire: forfaitaire,
    retenuesDetail: retenues.detail,
    exemptions, // raisons des exemptions appliquées (RRQ, assurance-emploi, CNESST)
    feries, // jours fériés de la période : [{ dateStr, nom, heures, travaille }]
    salaireBase,
    boni: boniFinal,
    vacancesAccumulees,
    soldeVacances,
    typePaie: typePaie === "VACANCES" ? "VACANCES" : "REGULIERE",
    ...resultat,
  };
}

module.exports = { calculerPaie, calculerPaiePourEmploye, chargerHoraireOuverture, heuresPrevuesJoursPoinconnes, tauxPourAnnee, anneeQuebec, lireTauxEmployeur, exemptionsEmploye, champsCalculPaie, CLES_TAUX_EMPLOYEUR, CLE_CONGE_PAQUES, PERIODES_PAR_AN, DERNIERE_ANNEE_TAUX };
