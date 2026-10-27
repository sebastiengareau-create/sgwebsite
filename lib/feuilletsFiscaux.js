// Sommaires de fin d'année pour les feuillets T4 (ARC) et RL-1 (Revenu
// Québec) : les montants de chaque case, par employé, tirés des paies
// versées pendant l'année (selon la date de versement, comme l'exigent les
// deux gouvernements). Ce ne sont pas les formulaires officiels : on
// recopie ces montants dans les Formulaires Web T4 de l'ARC et le service de
// Revenu Québec, ou on les remet au comptable.
const { prisma } = require("./prisma");
const { limitesMoisQuebec } = require("./temps");
const { RRQ, RQAP, AE } = require("./paie");

// Année des maximums (RRQ, RQAP, AE) de lib/paie.js — servent aux cases de
// gains admissibles ; une autre année est signalée à l'écran
const ANNEE_MAXIMUMS = 2026;

// Cases remplies à partir des paies — les autres restent vides
const CASES_T4 = [
  { cle: "revenus", t4: "14", libelle: "Revenus d'emploi" },
  { cle: "rrq", t4: "17", libelle: "Cotisations de l'employé au RRQ" },
  { cle: "ae", t4: "18", libelle: "Cotisations de l'employé à l'AE" },
  { cle: "impotFederal", t4: "22", libelle: "Impôt sur le revenu retenu" },
  { cle: "gainsAssurablesAe", t4: "24", libelle: "Gains assurables d'AE" },
  { cle: "gainsPension", t4: "26", libelle: "Gains ouvrant droit à pension – RPC/RRQ" },
  { cle: "rqap", t4: "55", libelle: "Cotisations de l'employé au RPAP" },
  { cle: "salaireRqap", t4: "56", libelle: "Gains assurables du RPAP" },
];
const CASES_RL1 = [
  { cle: "revenus", rl1: "A", libelle: "Revenus d'emploi" },
  { cle: "rrq", rl1: "B.A", libelle: "Cotisation au RRQ" },
  { cle: "ae", rl1: "C", libelle: "Cotisation à l'assurance emploi" },
  { cle: "impotQuebec", rl1: "E", libelle: "Impôt du Québec retenu" },
  { cle: "gainsPension", rl1: "G", libelle: "Salaire admissible au RRQ" },
  { cle: "rqap", rl1: "H", libelle: "Cotisation au RQAP" },
  { cle: "salaireRqap", rl1: "I", libelle: "Salaire admissible au RQAP" },
];

const arrondir = (n) => Math.round(n * 100) / 100;

async function calculerFeuillets(annee) {
  const debut = limitesMoisQuebec(annee, 1).debut;
  const fin = limitesMoisQuebec(annee, 12).fin;
  // Date de versement ; à défaut (ancienne paie), la fin de la période
  const dansAnnee = { OR: [{ dateVersement: { gte: debut, lte: fin } }, { dateVersement: null, periodeFin: { gte: debut, lte: fin } }] };

  const [paies, nbBrouillons] = await Promise.all([
    prisma.paie.findMany({ where: { statut: "VERSEE", ...dansAnnee } }),
    prisma.paie.count({ where: { statut: "BROUILLON", ...dansAnnee } }),
  ]);
  const employes = await prisma.user.findMany({
    where: { id: { in: [...new Set(paies.map((p) => p.employeId))] } },
    omit: { nas: false },
  });

  const parEmploye = new Map();
  for (const p of paies) {
    const t = parEmploye.get(p.employeId) || { brut: 0, rrq: 0, rqap: 0, ae: 0, impotFederal: 0, impotQuebec: 0, rrqEmployeur: 0, rqapEmployeur: 0, aeEmployeur: 0, nbPaies: 0 };
    t.brut += p.salaireBrut;
    t.rrq += p.rrqEmploye;
    t.rqap += p.rqapEmploye;
    t.ae += p.aeEmploye;
    t.impotFederal += p.impotFederal;
    t.impotQuebec += p.impotQuebec;
    t.rrqEmployeur += p.rrqEmployeur;
    t.rqapEmployeur += p.rqapEmployeur;
    t.aeEmployeur += p.aeEmployeur;
    t.nbPaies += 1;
    parEmploye.set(p.employeId, t);
  }

  const feuillets = employes
    .map((employe) => {
      const t = parEmploye.get(employe.id);
      const brut = arrondir(t.brut);
      const montants = {
        revenus: brut,
        rrq: arrondir(t.rrq),
        ae: arrondir(t.ae),
        rqap: arrondir(t.rqap),
        impotFederal: arrondir(t.impotFederal),
        impotQuebec: arrondir(t.impotQuebec),
        // Gains admissibles : seulement si des cotisations ont été retenues,
        // plafonnés au maximum de l'année
        gainsAssurablesAe: t.ae > 0 ? Math.min(brut, AE.maxAssurable) : 0,
        gainsPension: t.rrq > 0 ? Math.min(brut, RRQ.maxGainsAdmissibles) : 0,
        salaireRqap: t.rqap > 0 ? Math.min(brut, RQAP.maxAssurable) : 0,
      };
      return {
        employe: {
          id: employe.id, nom: employe.nom, numeroEmploye: employe.numeroEmploye, nas: employe.nas,
          adresse: employe.adresse, ville: employe.ville, province: employe.province, codePostal: employe.codePostal,
        },
        montants,
        employeur: { rrq: arrondir(t.rrqEmployeur), rqap: arrondir(t.rqapEmployeur), ae: arrondir(t.aeEmployeur) },
        nbPaies: t.nbPaies,
      };
    })
    .sort((a, b) => a.employe.nom.localeCompare(b.employe.nom, "fr"));

  const somme = (f) => arrondir(feuillets.reduce((s, x) => s + f(x), 0));
  const totaux = {
    revenus: somme((x) => x.montants.revenus),
    rrq: somme((x) => x.montants.rrq),
    rrqEmployeur: somme((x) => x.employeur.rrq),
    rqap: somme((x) => x.montants.rqap),
    rqapEmployeur: somme((x) => x.employeur.rqap),
    ae: somme((x) => x.montants.ae),
    aeEmployeur: somme((x) => x.employeur.ae),
    impotFederal: somme((x) => x.montants.impotFederal),
    impotQuebec: somme((x) => x.montants.impotQuebec),
  };

  return { annee, feuillets, totaux, nbBrouillons, maximumsAJour: annee === ANNEE_MAXIMUMS };
}

module.exports = { calculerFeuillets, CASES_T4, CASES_RL1, ANNEE_MAXIMUMS };
