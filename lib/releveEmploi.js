// Relevé d'emploi : préparé à partir des paies versées à l'employé (dates,
// heures et gains assurables par période), puis complété à la main dans
// le formulaire. Codes, vérifications et XML : lib/releveEmploiCalculs.js.
import { prisma } from "./prisma";
import { obtenirInfosEntreprise } from "./config";
import { dateQuebecStr, dateAujourdhuiQuebec } from "./temps";
import { nasValide } from "./nas";
import { nomsEmploye, nomFamilleDe, prenomDe } from "./nomsFeuillets";
import { decouperTelephone } from "./finAnnee";
import { TYPES_PERIODE, periodesDePaie, verifierReleve } from "./releveEmploiCalculs";

const arrondir = (n) => Math.round(Number(n || 0) * 100) / 100;
const jourCivil = (s) => new Date(`${s}T12:00:00Z`);
const texteJour = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// Paies prises en compte : versées (les corrigées sont remplacées par une autre)
async function paiesDe(employeId) {
  return prisma.paie.findMany({ where: { employeId, statut: "VERSEE" }, orderBy: { periodeFin: "desc" } });
}

// Gains et heures par période, de la plus récente à la plus ancienne. Une
// paie qui se termine après la dernière période (ex. vacances payées au
// départ) compte dans la période 1.
export function repartirParPeriode(paies, periodes) {
  const gains = periodes.map(() => 0);
  let heures = 0;
  for (const p of paies) {
    const fin = dateQuebecStr(p.periodeFin);
    let i = periodes.findIndex((per) => fin >= per.debut && fin <= per.fin);
    if (i === -1 && fin > periodes[0].fin) i = 0;
    if (i === -1) continue;
    gains[i] += p.salaireBrut;
    heures += (p.heuresTravaillees || 0) + (p.heuresSupplementaires || 0);
  }
  return { gains: gains.map(arrondir), heures: Math.ceil(heures - 1e-9) };
}

// Nouveau relevé pour un employé : tout ce que les paies permettent de remplir
export async function preparerReleve(employeId, { dernierJourPaye, exclureId } = {}) {
  const employe = await prisma.user.findUnique({ where: { id: employeId } });
  if (!employe) return null;
  const paies = await paiesDe(employeId);
  const typePeriode = TYPES_PERIODE[employe.frequencePaie] || "B";
  // Relevé déjà transmis pour un départ précédent (réembauche) : on repart
  // du jour qui suit
  const precedent = await prisma.releveEmploi.findFirst({
    where: { employeId, statut: "TRANSMIS", ...(exclureId && { id: { not: exclureId } }) },
    orderBy: { dernierJourPaye: "desc" },
  });
  const depuis = precedent ? texteJour(precedent.dernierJourPaye) : null;
  const paiesDepuis = depuis ? paies.filter((p) => dateQuebecStr(p.periodeFin) > depuis) : paies;

  const derniere = paiesDepuis.find((p) => p.typePaie !== "VACANCES" || !p.vacancesForfaitaire) || paiesDepuis[0];
  const b11 = dernierJourPaye || (derniere ? dateQuebecStr(derniere.periodeFin) : dateAujourdhuiQuebec());
  const contenant = paiesDepuis.find((p) => dateQuebecStr(p.periodeDebut) <= b11 && dateQuebecStr(p.periodeFin) >= b11);
  const b12 = contenant ? dateQuebecStr(contenant.periodeFin) : b11;
  const plusAncienne = paiesDepuis.at(-1);
  const embauche = employe.dateEmbauche ? texteJour(employe.dateEmbauche) : null;
  let b10 = plusAncienne ? dateQuebecStr(plusAncienne.periodeDebut) : b11;
  if (embauche && embauche > (depuis || "") && embauche <= b11) b10 = embauche;
  if (depuis && b10 <= depuis) b10 = texteJour(new Date(jourCivil(depuis).getTime() + 86400000));

  const periodes = periodesDePaie(typePeriode, b12, b10);
  // Les périodes sans paie dans le logiciel restent à 0 (congé sans solde,
  // ou paies faites avant le logiciel : à compléter dans le formulaire)
  const { gains, heures } = repartirParPeriode(paiesDepuis, periodes);

  // Vacances payées au départ (paie de vacances en plus du salaire, après
  // le dernier jour payé ou dans la dernière période) : code 2
  const vacancesDepart = paiesDepuis.filter((p) => p.typePaie === "VACANCES" && p.vacancesForfaitaire && dateQuebecStr(p.periodeFin) >= periodes[0].debut);
  const montantVacances = arrondir(vacancesDepart.reduce((s, p) => s + p.salaireBrut, 0));

  return {
    employeId,
    raison: "",
    premierJour: b10,
    dernierJourPaye: b11,
    finDernierePeriode: b12,
    typePeriode,
    rappel: "U",
    dateRappel: "",
    profession: employe.assignation || "",
    heuresAssurables: Math.max(heures, 0),
    gainsParPeriode: gains,
    vacances: montantVacances > 0 ? { code: "2", montant: montantVacances } : null,
    joursFeries: [],
    autresSommes: [],
    commentaires: "",
  };
}

// Relevé enregistré → forme du formulaire (dates en AAAA-MM-JJ)
export function versFormulaire(r) {
  return {
    id: r.id, employeId: r.employeId, raison: r.raison,
    premierJour: texteJour(r.premierJour), dernierJourPaye: texteJour(r.dernierJourPaye), finDernierePeriode: texteJour(r.finDernierePeriode),
    typePeriode: r.typePeriode, rappel: r.rappel, dateRappel: texteJour(r.dateRappel), profession: r.profession || "",
    heuresAssurables: r.heuresAssurables, gainsParPeriode: Array.isArray(r.gainsParPeriode) ? r.gainsParPeriode : [],
    vacances: r.vacances || null, joursFeries: r.joursFeries || [], autresSommes: r.autresSommes || [], commentaires: r.commentaires || "",
    statut: r.statut, numeroSerie: r.numeroSerie || "", transmisLe: r.transmisLe, creeLe: r.creeLe, modifieLe: r.modifieLe,
  };
}

// Formulaire → données à enregistrer
export function versEnregistrement(f) {
  const date = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") ? jourCivil(s) : null);
  const liste = (l) => (Array.isArray(l) ? l : []);
  return {
    raison: String(f.raison || ""),
    premierJour: date(f.premierJour),
    dernierJourPaye: date(f.dernierJourPaye),
    finDernierePeriode: date(f.finDernierePeriode),
    typePeriode: ["W", "B", "S", "M"].includes(f.typePeriode) ? f.typePeriode : "B",
    rappel: ["U", "Y", "N"].includes(f.rappel) ? f.rappel : "U",
    dateRappel: f.rappel === "Y" ? date(f.dateRappel) : null,
    profession: String(f.profession || "").trim().slice(0, 40) || null,
    heuresAssurables: Math.max(0, Math.ceil(Number(f.heuresAssurables) || 0)),
    gainsParPeriode: liste(f.gainsParPeriode).slice(0, 53).map((g) => arrondir(g)),
    vacances: f.vacances?.code ? { code: String(f.vacances.code), montant: arrondir(f.vacances.montant), debut: f.vacances.debut || undefined, fin: f.vacances.fin || undefined } : null,
    joursFeries: liste(f.joursFeries).slice(0, 10).map((j) => ({ date: String(j.date || ""), montant: arrondir(j.montant) })),
    autresSommes: liste(f.autresSommes).slice(0, 3).map((a) => ({ code: String(a.code || ""), montant: arrondir(a.montant) })),
    commentaires: String(f.commentaires || "").trim().slice(0, 160) || null,
  };
}

// L'employé et l'employeur tels qu'ils vont sur le relevé
export async function partiesDuReleve(employeId) {
  const [e, entreprise] = await Promise.all([
    prisma.user.findUnique({ where: { id: employeId }, omit: { nas: false } }),
    obtenirInfosEntreprise(),
  ]);
  const noms = nomsEmploye(e);
  const tel = decouperTelephone(entreprise.telephone);
  return {
    employe: {
      id: e.id, nom: e.nom, numeroEmploye: e.numeroEmploye, nas: e.nas, prenom: noms.prenom, nomFamille: noms.nomFamille,
      adresse: e.adresse, ville: e.ville, province: e.province, codePostal: e.codePostal, actif: e.actif,
    },
    employeur: {
      nom: entreprise.nomEntreprise, bn: entreprise.numeroEmployeurArc,
      contactPrenom: prenomDe(entreprise.personneResponsable), contactNom: nomFamilleDe(entreprise.personneResponsable),
      indicatif: tel?.indicatif || "", telephone7: tel?.sept || "", poste: tel?.poste || "",
    },
  };
}

export function verifier(formulaire, parties) {
  return verifierReleve(formulaire, { ...parties, aujourdhui: dateAujourdhuiQuebec(), nasValide });
}
