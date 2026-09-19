// Agrégation des factures (hors annulées) par période — jour, semaine ou
// mois — pour le rapport de ventes. Lecture seule, aucune écriture créée.
const { dateQuebecStr, limitesJourQuebec, dateAujourdhuiQuebec } = require("./temps");

const GROUPEMENTS_VALIDES = ["jour", "semaine", "mois"];

// Lit debut/fin/groupement depuis des searchParams (page ou route API), avec
// le mois en cours comme plage par défaut — même logique dans les trois
// endroits qui en ont besoin (page, export PDF, export CSV).
function analyserFiltresPeriode(params) {
  const aujourdhui = dateAujourdhuiQuebec();
  const [an, mois] = aujourdhui.split("-");
  const debutStr = params.debut || `${an}-${mois}-01`;
  const finStr = params.fin || aujourdhui;
  const groupement = GROUPEMENTS_VALIDES.includes(params.groupement) ? params.groupement : "jour";
  const { debut } = limitesJourQuebec(debutStr);
  const { fin } = limitesJourQuebec(finStr);
  return { debutStr, finStr, groupement, debut, fin };
}

// Lundi de la semaine (heure Québec) contenant ce jour calendaire.
function cleSemaine(jourStr) {
  const [an, mois, jour] = jourStr.split("-").map(Number);
  const date = new Date(Date.UTC(an, mois - 1, jour));
  const jourSemaine = date.getUTCDay(); // 0 = dimanche
  const decalage = jourSemaine === 0 ? 6 : jourSemaine - 1;
  date.setUTCDate(date.getUTCDate() - decalage);
  return date.toISOString().slice(0, 10);
}

function libellePeriode(cle, groupement) {
  if (groupement === "mois") {
    const [an, mois] = cle.split("-").map(Number);
    return new Date(Date.UTC(an, mois - 1, 1)).toLocaleDateString("fr-CA", { timeZone: "UTC", month: "long", year: "numeric" });
  }
  if (groupement === "semaine") {
    const debut = new Date(`${cle}T12:00:00Z`);
    const fin = new Date(debut);
    fin.setUTCDate(fin.getUTCDate() + 6);
    const fmt = (d) => d.toLocaleDateString("fr-CA", { timeZone: "UTC", day: "numeric", month: "short" });
    return `${fmt(debut)} – ${fmt(fin)}`;
  }
  return new Date(`${cle}T12:00:00Z`).toLocaleDateString("fr-CA", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

const LIGNE_VIDE = { nombreFactures: 0, totalPieces: 0, totalMainOeuvre: 0, totalAutresRevenus: 0, totalAvantTaxes: 0, tps: 0, tvq: 0, totalAvecTaxes: 0 };

// factures : liste de Facture (Prisma), déjà filtrée sur la plage de dates
// voulue et idéalement sans les ANNULEE (une vente annulée n'est pas une vente).
function calculerRapportVentes(factures, groupement = "jour") {
  const groupes = new Map();
  for (const f of factures) {
    const jourStr = dateQuebecStr(f.dateEmission);
    const cle = groupement === "mois" ? jourStr.slice(0, 7) : groupement === "semaine" ? cleSemaine(jourStr) : jourStr;
    if (!groupes.has(cle)) groupes.set(cle, { cle, ...LIGNE_VIDE });
    const g = groupes.get(cle);
    g.nombreFactures += 1;
    g.totalPieces += f.totalPieces;
    g.totalMainOeuvre += f.totalMainOeuvre;
    g.totalAutresRevenus += f.totalAutresRevenus;
    g.totalAvantTaxes += f.totalFacture;
    g.tps += f.tpsMontant;
    g.tvq += f.tvqMontant;
    g.totalAvecTaxes += f.totalAvecTaxes;
  }

  const lignes = Array.from(groupes.values())
    .sort((a, b) => (a.cle < b.cle ? 1 : -1))
    .map((g) => ({ ...g, libelle: libellePeriode(g.cle, groupement) }));

  const totaux = lignes.reduce((acc, l) => ({
    nombreFactures: acc.nombreFactures + l.nombreFactures,
    totalPieces: acc.totalPieces + l.totalPieces,
    totalMainOeuvre: acc.totalMainOeuvre + l.totalMainOeuvre,
    totalAutresRevenus: acc.totalAutresRevenus + l.totalAutresRevenus,
    totalAvantTaxes: acc.totalAvantTaxes + l.totalAvantTaxes,
    tps: acc.tps + l.tps,
    tvq: acc.tvq + l.tvq,
    totalAvecTaxes: acc.totalAvecTaxes + l.totalAvecTaxes,
  }), { ...LIGNE_VIDE });

  const ticketMoyen = totaux.nombreFactures > 0 ? totaux.totalAvantTaxes / totaux.nombreFactures : 0;

  return { lignes, totaux, ticketMoyen };
}

module.exports = { calculerRapportVentes, analyserFiltresPeriode };
