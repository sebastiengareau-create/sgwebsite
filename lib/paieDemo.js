// Paie de démonstration (Administrateur → Paie de démonstration) : de quoi
// présenter le module Paie sans toucher aux vrais employés — quatre employés
// fictifs (deux mécaniciens et un apprenti à l'heure, une adjointe à
// salaire ; REER et assurance collective retenus chez l'un, vacances à 6 %
// chez une autre), dix semaines d'heures poinçonnées (une semaine d'heures
// supplémentaires, deux absences), trois lots comptabilisés (talons,
// cumulatifs, remises à payer, écritures) et le lot de la dernière période
// en brouillon, prêt à traiter.
//
// Les paies sont calculées et comptabilisées par les mêmes fonctions que
// l'appli (calculerPaiePourEmploye, posterPaie). Les heures sont poinçonnées
// sur une tâche interne, et pointées en quarts : la démonstration vaut aussi
// avec le module « Pointage de quart et feuilles de temps ».
//
// Chargée seulement s'il n'y a encore aucun lot de paie (la numérotation
// repart ainsi de 001 une fois la démonstration retirée). Ce qui est créé
// est noté dans le paramètre « paie_demo » : « Retirer » efface les employés
// de démonstration avec leurs paies (y compris celles faites pendant les
// essais), leurs écritures et leurs heures, sans toucher aux vrais employés.

import crypto from "crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { dateAujourdhuiQuebec, dateHeureQuebecVersUTC } from "./temps";
import { prochainNumeroEmploye, prochainNumeroLotPaie, creerAvecNumero } from "./numerotation";
import { calculerPaiePourEmploye, champsCalculPaie } from "./paie";
import { posterPaie } from "./comptabilite";
import { joursFeriesEntre } from "./joursFeries";

export const AUTEUR_PAIE_DEMO = "Paie de démonstration";
const CLE = "paie_demo";
const TACHE = "Travail en atelier (démonstration)";

// NAS fictif : commence par 0 (jamais attribué), avec une clé de contrôle
// valide pour que les feuillets T4 / RL-1 se présentent comme les vrais
function nasFictif(huit) {
  const somme = [...huit].reduce((s, c, i) => {
    const n = Number(c) * (i % 2 === 1 ? 2 : 1);
    return s + (n > 9 ? n - 9 : n);
  }, 0);
  return `${huit}${(10 - (somme % 10)) % 10}`;
}

// horaire : à l'heure, payé selon les jours poinçonnés ; l'adjointe (rôle à
// horaire complet) est à salaire
const EMPLOYES = [
  { nom: "Simon Bélanger (démo)", courriel: "simon.paie@demonstration.invalid", role: "MECANICIEN", assignation: "Mécanique générale", tauxHoraireEmploye: 34, nas: nasFictif("01234567"), dateNaissance: "1984-03-12", embauche: 2600, prenom: "Simon", nomFamille: "Bélanger", adresse: "145, rue Champlain", ville: "Saint-Jean-sur-Richelieu", codePostal: "J3B 6V5",
    retenues: [{ libelle: "REER collectif", type: "REER", montant: 50 }, { libelle: "Assurance collective", type: "APRES_IMPOT", montant: 38.5 }] },
  { nom: "Annie Morin (démo)", courriel: "annie.paie@demonstration.invalid", role: "MECANICIEN", assignation: "Freins et suspension", tauxHoraireEmploye: 30, tauxVacances: 6, nas: nasFictif("02345678"), dateNaissance: "1990-09-27", embauche: 1500, prenom: "Annie", nomFamille: "Morin", adresse: "2210, avenue Bourgogne", ville: "Chambly", codePostal: "J3L 2A4" },
  { nom: "Julien Roy (démo)", courriel: "julien.paie@demonstration.invalid", role: "MECANICIEN", assignation: "Apprenti", tauxHoraireEmploye: 22, nas: nasFictif("03456789"), dateNaissance: "2005-06-04", embauche: 240, prenom: "Julien", nomFamille: "Roy", adresse: "88, 1re Rue", ville: "Iberville", codePostal: "J2X 3B7" },
  { nom: "Carole Dubois (démo)", courriel: "carole.paie@demonstration.invalid", role: "SECRETAIRE", assignation: "Adjointe administrative", typeRemuneration: "SALAIRE", salaireAnnuel: 52000, nas: nasFictif("04567890"), dateNaissance: "1978-11-19", embauche: 3300, prenom: "Carole", nomFamille: "Dubois", adresse: "17, rue des Cerisiers", ville: "Saint-Luc", codePostal: "J2W 1K9" },
];

// ---------- Outils ----------

const decaler = (dateStr, jours) => new Date(new Date(`${dateStr}T12:00:00Z`).getTime() + jours * 86400000).toISOString().slice(0, 10);
const jourSemaine = (dateStr) => new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0 = dimanche
const jourCivil = (dateStr) => new Date(`${dateStr}T12:00:00Z`);
const instant = (dateStr, heure) => dateHeureQuebecVersUTC(dateStr, heure);

// Les dossiers notés au chargement — null si rien n'est chargé, ou si les
// données ont été effacées depuis (Réinitialisation garde les paramètres)
async function lireIds() {
  const p = await prisma.parametre.findUnique({ where: { cle: CLE } });
  if (!p) return null;
  let ids;
  try { ids = JSON.parse(p.valeur); } catch { return null; }
  const reste = await Promise.all([
    prisma.user.count({ where: { id: { in: ids.employes } } }), prisma.lotPaie.count({ where: { id: { in: ids.lots } } }),
    prisma.tacheInterne.count({ where: { id: { in: ids.taches } } }),
  ]);
  return reste.some((n) => n > 0) ? ids : null;
}
const noterIds = (ids) => prisma.parametre.upsert({ where: { cle: CLE }, update: { valeur: JSON.stringify(ids) }, create: { cle: CLE, valeur: JSON.stringify(ids) } });

// → { charge, employes, paies (des employés de démonstration), lots (tous) }
export async function etatPaieDemo() {
  const ids = await lireIds();
  const [lots, employes, paies] = await Promise.all([
    prisma.lotPaie.count(),
    ids ? prisma.user.count({ where: { id: { in: ids.employes } } }) : 0,
    ids ? prisma.paie.count({ where: { employeId: { in: ids.employes } } }) : 0,
  ]);
  return { charge: !!ids, employes, paies, lots };
}

// ---------- Chargement ----------

// → { employes, lots, paies } ou { erreur }
export async function chargerPaieDemo() {
  if (await lireIds()) return { erreur: "La paie de démonstration est déjà chargée." };
  if ((await prisma.lotPaie.count()) > 0) return { erreur: "Il y a déjà des lots de paie : la paie de démonstration ne se charge que s'il n'y en a encore aucun." };
  const pris = await prisma.user.findMany({ where: { courriel: { in: EMPLOYES.map((e) => e.courriel) } }, select: { nom: true } });
  if (pris.length > 0) return { erreur: `Des employés de démonstration existent déjà (${pris.map((e) => e.nom).join(", ")}) : supprime-les ou réactive la démonstration précédente.` };

  const ids = { employes: [], taches: [], lots: [] };
  try {
    await noterIds(ids);
    const aujourdhui = dateAujourdhuiQuebec();
    // Quatre périodes de deux semaines (dimanche au samedi) ; la dernière se
    // termine au dernier samedi passé
    const dernierSamedi = decaler(aujourdhui, -(jourSemaine(aujourdhui) + 1));
    const periodes = [3, 2, 1, 0].map((k) => {
      const fin = decaler(dernierSamedi, -14 * k);
      return { debut: decaler(fin, -13), fin, versement: decaler(fin, 5) };
    });

    const employes = [];
    for (const { retenues = [], embauche, dateNaissance, ...e } of EMPLOYES) {
      employes.push(await prisma.user.create({
        data: {
          ...e, province: "QC", numeroEmploye: await prochainNumeroEmploye(), motDePasse: await hashPassword(crypto.randomBytes(24).toString("hex")),
          dateNaissance: jourCivil(dateNaissance), dateEmbauche: jourCivil(decaler(aujourdhui, -embauche)),
          retenues: { create: retenues },
        },
      }));
      ids.employes.push(employes.at(-1).id);
    }
    const tache = await prisma.tacheInterne.create({ data: { nom: TACHE } });
    ids.taches.push(tache.id);
    await noterIds(ids);
    const [simon, annie, julien] = employes;

    // Heures : du lundi au jeudi 8 h à 16 h 30 (dîner de 30 minutes), le
    // vendredi 8 h à 13 h — depuis quatre semaines avant la première période
    // (référence de l'indemnité des jours fériés) jusqu'à hier. Annie fait une
    // semaine de longues journées (heures supplémentaires) ; Julien manque
    // deux jours. Personne ne travaille un jour férié (indemnité calculée).
    const semaineLongue = decaler(periodes[2].debut, 1); // lundi de la 1re semaine de l'avant-dernière période
    const absences = new Set([decaler(periodes[1].debut, 3), decaler(periodes[1].debut, 4)]);
    const feries = new Set(joursFeriesEntre(decaler(periodes[0].debut, -28), aujourdhui).map((f) => f.dateStr));
    const poincons = [];
    const quarts = [];
    for (let jour = decaler(periodes[0].debut, -28); jour < aujourdhui; jour = decaler(jour, 1)) {
      const j = jourSemaine(jour);
      if (j === 0 || j === 6 || feries.has(jour)) continue;
      for (const employe of [simon, annie, julien]) {
        if (employe === julien && absences.has(jour)) continue;
        const longue = employe === annie && jour >= semaineLongue && jour < decaler(semaineLongue, 4);
        const [arrivee, depart] = j === 5 ? ["8:00", "13:00"] : longue ? ["7:00", "18:00"] : ["8:00", "16:30"];
        const segments = j === 5 ? [[arrivee, depart]] : [[arrivee, "12:00"], ["12:30", depart]];
        for (const [de, a] of segments) poincons.push({ employeId: employe.id, tacheInterneId: tache.id, debut: instant(jour, de), fin: instant(jour, a) });
        quarts.push({ employeId: employe.id, type: "TRAVAIL", debut: instant(jour, arrivee), fin: instant(jour, depart) });
        if (j !== 5) quarts.push({ employeId: employe.id, type: "DINER", debut: instant(jour, "12:00"), fin: instant(jour, "12:30") });
      }
    }
    await prisma.entreeTempsInterne.createMany({ data: poincons });
    await prisma.quart.createMany({ data: quarts });

    // Lots, du plus ancien au plus récent (les cumulatifs de l'année suivent
    // les paies déjà versées) : trois comptabilisés, le dernier en brouillon.
    // Une prime à Simon sur le troisième.
    let nbPaies = 0;
    for (const [rang, periode] of periodes.entries()) {
      const comptabiliser = rang < periodes.length - 1;
      const versement = jourCivil(periode.versement);
      const resultats = [];
      for (const employe of employes) {
        const r = await calculerPaiePourEmploye(employe.id, {
          periodeDebut: periode.debut, periodeFin: periode.fin, dateVersement: versement, typePaie: "REGULIERE",
          boni: rang === 2 && employe === simon ? 250 : undefined,
        });
        if (r.erreur) throw new Error(r.erreur);
        resultats.push({ employeId: employe.id, ...r });
      }
      const lot = await creerAvecNumero(prochainNumeroLotPaie, (numero) => prisma.lotPaie.create({
        data: {
          numero, periodeDebut: jourCivil(periode.debut), periodeFin: jourCivil(periode.fin), dateVersementPrevue: versement,
          typePaie: "REGULIERE", creePar: AUTEUR_PAIE_DEMO, creeLe: comptabiliser ? versement : new Date(),
          paies: {
            create: resultats.map((r) => ({
              employeId: r.employeId, periodeDebut: jourCivil(periode.debut), periodeFin: jourCivil(periode.fin), dateVersement: versement,
              ...champsCalculPaie(r), typePaie: "REGULIERE", statut: "BROUILLON",
            })),
          },
        },
        include: { paies: { include: { employe: true } } },
      }));
      ids.lots.push(lot.id);
      await noterIds(ids);
      nbPaies += lot.paies.length;
      if (!comptabiliser) continue;
      // Comme « Traiter le lot » : l'écriture d'abord, puis la paie versée
      for (const paie of lot.paies) {
        await posterPaie(paie, AUTEUR_PAIE_DEMO);
        await prisma.paie.update({ where: { id: paie.id }, data: { statut: "VERSEE", modePaiement: "VIREMENT" } });
      }
      await prisma.lotPaie.update({ where: { id: lot.id }, data: { statut: "COMPTABILISEE", comptabiliseLe: versement } });
    }
    return { employes: employes.length, lots: periodes.length, paies: nbPaies };
  } catch (e) {
    console.error("Paie de démonstration : échec du chargement", e);
    await noterIds(ids);
    await retirerPaieDemo().catch((e2) => console.error("Paie de démonstration : échec du nettoyage", e2));
    const message = String(e.message || e);
    return { erreur: message.startsWith("PERIODE_LOCK:") ? "Le chargement a échoué : une date de versement tombe dans une période comptable fermée." : `Le chargement a échoué : ${message.split("\n")[0]}` };
  }
}

// ---------- Retrait ----------

// Retire les employés de démonstration avec leurs paies (y compris celles
// faites pendant les essais), les écritures de ces paies, les lots restés
// vides, leurs heures (tâche interne, quarts) et leurs retenues. Un employé
// de démonstration qui a servi à un vrai dossier (heures sur un bon…) ne se
// supprime pas : il est désactivé.
// → { employes, paies, lots, gardes } ou { erreur }
export async function retirerPaieDemo() {
  const ids = await lireIds();
  if (!ids) return { erreur: "La paie de démonstration n'est pas chargée." };

  const paies = await prisma.paie.findMany({ where: { employeId: { in: ids.employes } }, select: { id: true, lotId: true } });
  const paieIds = paies.map((p) => p.id);
  const lotIds = [...new Set([...ids.lots, ...paies.map((p) => p.lotId).filter(Boolean)])];
  const ecritures = { source: "PAIE", sourceId: { in: paieIds } };
  const concilie = await prisma.ligneEcriture.count({ where: { ecriture: ecritures, OR: [{ rapprochementId: { not: null } }, { transactionBancaireId: { not: null } }] } });
  if (concilie > 0) return { erreur: "Des paies de démonstration sont associées à une transaction bancaire ou à une conciliation : annule-les d'abord (Comptabilité)." };

  const lots = await prisma.$transaction(async (tx) => {
    await tx.ecritureComptable.deleteMany({ where: ecritures });
    await tx.paie.deleteMany({ where: { id: { in: paieIds } } });
    // Un lot qui contenait aussi de vrais employés reste, avec leurs paies
    const { count } = await tx.lotPaie.deleteMany({ where: { id: { in: lotIds }, paies: { none: {} } } });
    await tx.entreeTempsInterne.deleteMany({ where: { OR: [{ employeId: { in: ids.employes } }, { tacheInterneId: { in: ids.taches } }] } });
    await tx.tacheInterne.deleteMany({ where: { id: { in: ids.taches } } });
    await tx.quart.deleteMany({ where: { employeId: { in: ids.employes } } });
    return count;
  }, { timeout: 60000 });

  let employes = 0;
  let gardes = 0;
  for (const id of ids.employes) {
    try {
      await prisma.user.delete({ where: { id } });
      employes++;
    } catch {
      if ((await prisma.user.updateMany({ where: { id }, data: { actif: false } })).count > 0) gardes++;
    }
  }
  await prisma.parametre.deleteMany({ where: { cle: CLE } });
  return { employes, paies: paieIds.length, lots, gardes };
}
