// Pointage de démonstration (Administrateur → Pointage de démonstration) :
// de quoi présenter le module « Pointage de quart et feuilles de temps »
// sans toucher aux vrais employés — trois employés fictifs qui pointent
// arrivée, dîner, pause et départ depuis six semaines, avec leur temps sur
// des bons et sur une tâche interne (efficacité élevée, moyenne et faible).
//
// - La période précédente est approuvée et verrouillée : une semaine d'heures
//   supplémentaires, une prime, et deux corrections consignées au journal
//   (départ corrigé, quart ajouté à la main).
// - La période en cours est ouverte, avec ce qu'un gérant doit régler : un
//   départ non pointé fermé automatiquement, du temps poinçonné en dehors du
//   quart, un dîner jamais pointé, un quart resté ouvert (bloquant) et, un
//   jour de semaine, un quart en cours.
//
// Le temps sur les bons demande des bons : un client et deux bons « flotte de
// démonstration » sont créés, sur un poste de revenu à 0 $ (ils ne gonflent
// ni les travaux en cours ni une facture).
//
// Chargé seulement s'il n'y a encore aucune période de feuille de temps. Ce
// qui est créé est noté dans le paramètre « quarts_demo » : « Retirer »
// efface les employés de démonstration avec leurs quarts, leurs heures, leur
// journal de corrections, les périodes et les bons de démonstration, sans
// toucher aux vrais employés.

import crypto from "crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { dateAujourdhuiQuebec, dateHeureQuebecVersUTC } from "./temps";
import { prochainNumeroEmploye, prochainNumeroClient, prochainNumeroBon } from "./numerotation";
import { decrireQuart } from "./quarts";
import { joursFeriesEntre } from "./joursFeries";
import { remettreLigneEnStock } from "./bons";

export const AUTEUR_QUARTS_DEMO = "Pointage de démonstration";
export const CLE_QUARTS_DEMO = "quarts_demo";
const TACHE = "Ménage et entretien de l'atelier (démonstration)";

// matin : minutes entre l'arrivée et le premier bon ; apresMidi : fin du
// temps sur les bons (minutes depuis minuit) ; interne : minutes de tâche
// interne ensuite — d'où l'efficacité de chacun
const EMPLOYES = [
  { nom: "Marco Leduc (démo)", courriel: "marco.quarts@demonstration.invalid", assignation: "Mécanique générale", tauxHoraireEmploye: 33, matin: 5, apresMidi: 15 * 60 + 50, interne: 30, vendredi: 12 * 60 + 40 },
  { nom: "Sarah Nadeau (démo)", courriel: "sarah.quarts@demonstration.invalid", assignation: "Freins et pneus", tauxHoraireEmploye: 29, matin: 10, apresMidi: 15 * 60, interne: 45, vendredi: 12 * 60 },
  { nom: "Kevin Paradis (démo)", courriel: "kevin.quarts@demonstration.invalid", assignation: "Apprenti", tauxHoraireEmploye: 21, matin: 50, apresMidi: 14 * 60 + 10, interne: 30, vendredi: 11 * 60 + 15 },
];

// ---------- Outils ----------

const decaler = (dateStr, jours) => new Date(new Date(`${dateStr}T12:00:00Z`).getTime() + jours * 86400000).toISOString().slice(0, 10);
const jourSemaine = (dateStr) => new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0 = dimanche
// Instant d'un jour du Québec, à `minutes` depuis minuit
const instant = (dateStr, minutes) => dateHeureQuebecVersUTC(dateStr, `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`);

// Les dossiers notés au chargement — null si rien n'est chargé, ou si les
// données ont été effacées depuis (Réinitialisation garde les paramètres)
async function lireIds() {
  const p = await prisma.parametre.findUnique({ where: { cle: CLE_QUARTS_DEMO } });
  if (!p) return null;
  let ids;
  try { ids = JSON.parse(p.valeur); } catch { return null; }
  const reste = await Promise.all([
    prisma.user.count({ where: { id: { in: ids.employes } } }), prisma.client.count({ where: { id: { in: ids.clients } } }),
    prisma.periodeTemps.count({ where: { id: { in: ids.periodes } } }), prisma.tacheInterne.count({ where: { id: { in: ids.taches } } }),
  ]);
  return reste.some((n) => n > 0) ? ids : null;
}
const noterIds = (ids) => prisma.parametre.upsert({ where: { cle: CLE_QUARTS_DEMO }, update: { valeur: JSON.stringify(ids) }, create: { cle: CLE_QUARTS_DEMO, valeur: JSON.stringify(ids) } });

// → { charge, employes, quarts (des employés de démonstration), periodes (toutes) }
export async function etatQuartsDemo() {
  const ids = await lireIds();
  const [periodes, employes, quarts] = await Promise.all([
    prisma.periodeTemps.count(),
    ids ? prisma.user.count({ where: { id: { in: ids.employes } } }) : 0,
    ids ? prisma.quart.count({ where: { employeId: { in: ids.employes } } }) : 0,
  ]);
  return { charge: !!ids, employes, quarts, periodes };
}

// ---------- Chargement ----------

// → { employes, quarts } ou { erreur }
export async function chargerQuartsDemo() {
  if (await lireIds()) return { erreur: "Le pointage de démonstration est déjà chargé." };
  if ((await prisma.periodeTemps.count()) > 0) return { erreur: "Il y a déjà des périodes de feuille de temps : le pointage de démonstration ne se charge que s'il n'y en a encore aucune." };
  const pris = await prisma.user.findMany({ where: { courriel: { in: EMPLOYES.map((e) => e.courriel) } }, select: { nom: true } });
  if (pris.length > 0) return { erreur: `Des employés de démonstration existent déjà (${pris.map((e) => e.nom).join(", ")}).` };

  const ids = { employes: [], clients: [], taches: [], periodes: [] };
  try {
    await noterIds(ids);
    const aujourdhui = dateAujourdhuiQuebec();
    // Période en cours : les deux semaines (dimanche au samedi) qui se
    // terminent ce samedi — celle que la feuille de temps propose. La
    // précédente est verrouillée.
    const samedi = decaler(aujourdhui, 6 - jourSemaine(aujourdhui));
    const enCours = { debut: decaler(samedi, -13), fin: samedi };
    const precedente = { debut: decaler(enCours.debut, -14), fin: decaler(enCours.debut, -1) };
    const depuis = decaler(precedente.debut, -14);
    const feries = new Set(joursFeriesEntre(depuis, aujourdhui).map((f) => f.dateStr));
    const ouvrable = (jour) => jourSemaine(jour) !== 0 && jourSemaine(jour) !== 6 && !feries.has(jour);

    const employes = [];
    for (const { matin, apresMidi, interne, vendredi, ...e } of EMPLOYES) {
      employes.push(await prisma.user.create({
        data: { ...e, role: "MECANICIEN", numeroEmploye: await prochainNumeroEmploye(), motDePasse: await hashPassword(crypto.randomBytes(24).toString("hex")), dateEmbauche: new Date(`${decaler(aujourdhui, -500)}T12:00:00Z`) },
      }));
      ids.employes.push(employes.at(-1).id);
    }
    const tache = await prisma.tacheInterne.create({ data: { nom: TACHE } });
    ids.taches.push(tache.id);
    await noterIds(ids);

    // Client et bons qui portent le temps « sur les bons » : une tâche par
    // employé sur chaque bon, sur le poste Autres revenus à 0 $ (rien à
    // facturer, rien dans les travaux en cours)
    const client = await prisma.client.create({ data: { nom: "Flotte de démonstration (pointage)", numero: await prochainNumeroClient(), ville: "Saint-Jean-sur-Richelieu", province: "QC" } });
    ids.clients.push(client.id);
    await noterIds(ids);
    const bons = [];
    for (const titre of ["Entretien de la flotte — camions (démonstration)", "Entretien de la flotte — remorques (démonstration)"]) {
      bons.push(await prisma.bonTravail.create({
        data: {
          numero: await prochainNumeroBon(), clientId: client.id, statut: "EN_COURS", noteInterne: "Bon de démonstration du pointage de quart : il porte le temps des employés de démonstration.",
          problemes: { create: employes.map((e) => ({ description: `${titre} — ${e.nom}`, categorieRevenu: "4060", factureDescription: titre, facturePrixUnitaire: 0, factureQte: 1 })) },
        },
        include: { problemes: { orderBy: { id: "asc" } } },
      }));
    }
    const probleme = (bon, employe) => bon.problemes.find((p) => p.description.endsWith(employe.nom)).id;

    // Jours particuliers
    const semaineLongue = decaler(precedente.debut, 1); // lundi au jeudi : heures supplémentaires de Marco
    const jourCorrige = decaler(precedente.debut, 3); // Kevin : départ pointé en retard, corrigé
    const jourAjoute = decaler(precedente.debut, 8); // Sarah : n'a pas pointé, quart ajouté à la main
    const jourFermeAuto = decaler(enCours.debut, 2); // Sarah : départ non pointé, fermé automatiquement
    const jourSansDiner = decaler(enCours.debut, 3); // Sarah : dîner jamais pointé
    const jourHorsQuart = decaler(enCours.debut, 4); // Sarah : tâche poinçonnée après son départ
    let jourOublie = decaler(aujourdhui, -1); // Kevin : quart resté ouvert, dernier jour ouvrable passé
    while (!ouvrable(jourOublie)) jourOublie = decaler(jourOublie, -1);

    const quarts = [];
    const tempsBons = [];
    const tempsInternes = [];
    let rang = 0;
    for (let jour = depuis; jour < aujourdhui; jour = decaler(jour, 1)) {
      if (!ouvrable(jour)) continue;
      rang++;
      const vendredi = jourSemaine(jour) === 5;
      for (const [i, e] of employes.entries()) {
        const reglage = EMPLOYES[i];
        const ecart = ((rang * 7 + i * 3) % 9) - 4; // −4 à +4 minutes, toujours le même pour un jour donné
        const arrivee = 8 * 60 + ecart - (i === 0 ? 6 : 0);
        const longue = i === 0 && jour >= semaineLongue && jour < decaler(semaineLongue, 4);
        const depart = (vendredi ? 13 * 60 : longue ? 18 * 60 + 30 : 16 * 60 + 30) + ((rang * 5 + i) % 8);

        // Kevin, dernier jour ouvrable : arrivée pointée, puis plus rien
        if (i === 2 && jour === jourOublie) {
          quarts.push({ employeId: e.id, type: "TRAVAIL", debut: instant(jour, arrivee), fin: null });
          continue;
        }

        // Temps sur les bons et sur la tâche interne
        const sur = (liste, cible, de, a) => { if (a > de) liste.push({ employeId: e.id, ...cible, debut: instant(jour, de), fin: instant(jour, a) }); };
        const bonMatin = { problemeId: probleme(bons[0], e) };
        const bonApresMidi = { problemeId: probleme(bons[1], e) };
        let finTaches;
        if (vendredi) {
          sur(tempsBons, bonMatin, arrivee + reglage.matin, reglage.vendredi);
          sur(tempsInternes, { tacheInterneId: tache.id }, reglage.vendredi + 5, Math.min(reglage.vendredi + 5 + reglage.interne, depart - 5));
          finTaches = Math.min(reglage.vendredi + 5 + reglage.interne, depart - 5);
        } else {
          if (i === 0) {
            sur(tempsBons, bonMatin, arrivee + reglage.matin, 10 * 60);
            sur(tempsBons, bonMatin, 10 * 60 + 15, 11 * 60 + 55);
          } else {
            sur(tempsBons, bonMatin, arrivee + reglage.matin, 11 * 60 + 55);
          }
          sur(tempsBons, bonApresMidi, 12 * 60 + 35 + ecart, reglage.apresMidi);
          finTaches = Math.min(reglage.apresMidi + 5 + reglage.interne, depart - 5);
          sur(tempsInternes, { tacheInterneId: tache.id }, reglage.apresMidi + 5, finTaches);
          if (longue) {
            sur(tempsBons, bonApresMidi, 16 * 60 + 35, depart - 5);
            finTaches = depart - 5;
          }
          // Sarah repasse poinçonner une tâche après avoir pointé son départ
          if (i === 1 && jour === jourHorsQuart) sur(tempsBons, bonApresMidi, depart + 12, depart + 42);
        }

        // Quart, dîner, pause
        const quart = { employeId: e.id, type: "TRAVAIL", debut: instant(jour, arrivee), fin: instant(jour, depart) };
        if (i === 1 && jour === jourFermeAuto) Object.assign(quart, { fin: instant(jour, finTaches), fermeAuto: true });
        if (i === 2 && jour === jourCorrige) Object.assign(quart, { debutOriginal: quart.debut, finOriginal: instant(jour, 19 * 60 + 47), modifiePar: AUTEUR_QUARTS_DEMO, modifieLe: instant(decaler(jour, 1), 9 * 60 + 10) });
        if (i === 1 && jour === jourAjoute) Object.assign(quart, { debut: instant(jour, 8 * 60), fin: instant(jour, 16 * 60 + 30), ajoutePar: AUTEUR_QUARTS_DEMO });
        quarts.push(quart);
        if (!vendredi && !(i === 1 && (jour === jourSansDiner || jour === jourAjoute))) {
          quarts.push({ employeId: e.id, type: "DINER", debut: instant(jour, 12 * 60 + ecart), fin: instant(jour, 12 * 60 + 30 + ecart) });
        }
        if (i === 0 && !vendredi) quarts.push({ employeId: e.id, type: "PAUSE", debut: instant(jour, 10 * 60), fin: instant(jour, 10 * 60 + 15) });
      }
    }
    // Aujourd'hui, un jour ouvrable entre 8 h 15 et 16 h 30 : Marco est arrivé, son quart est en cours
    const debutMarco = instant(aujourdhui, 7 * 60 + 55);
    if (ouvrable(aujourdhui) && Date.now() > debutMarco.getTime() + 20 * 60000 && Date.now() < instant(aujourdhui, 16 * 60 + 30).getTime()) quarts.push({ employeId: employes[0].id, type: "TRAVAIL", debut: debutMarco, fin: null });

    await prisma.quart.createMany({ data: quarts });
    await prisma.entreeTemps.createMany({ data: tempsBons });
    await prisma.entreeTempsInterne.createMany({ data: tempsInternes });

    // Journal des corrections de la période précédente, puis son approbation
    const [marco, sarah, kevin] = employes;
    const lendemain = (jour, minutes) => instant(decaler(jour, 1), minutes);
    const corrige = await prisma.quart.findFirst({ where: { employeId: kevin.id, type: "TRAVAIL", modifiePar: AUTEUR_QUARTS_DEMO } });
    const ajoute = await prisma.quart.findFirst({ where: { employeId: sarah.id, type: "TRAVAIL", ajoutePar: AUTEUR_QUARTS_DEMO } });
    const approuveLe = instant(decaler(precedente.fin, 2), 9 * 60 + 30);
    const journal = [];
    if (corrige) journal.push({ quartId: corrige.id, employeId: kevin.id, employeNom: kevin.nom, jour: jourCorrige, action: "MODIFICATION", ancienne: decrireQuart({ ...corrige, fin: corrige.finOriginal }), nouvelle: decrireQuart(corrige), raison: "Départ pointé en retard, de retour du souper — heure confirmée avec l'employé.", creeLe: lendemain(jourCorrige, 9 * 60 + 10) });
    if (ajoute) journal.push({ quartId: ajoute.id, employeId: sarah.id, employeNom: sarah.nom, jour: jourAjoute, action: "AJOUT", nouvelle: decrireQuart(ajoute), raison: "N'a pas pointé de la journée — présente selon ses bons.", creeLe: lendemain(jourAjoute, 8 * 60 + 45) });
    journal.push({ employeId: marco.id, employeNom: marco.nom, jour: precedente.debut, action: "PRIME", ancienne: "0.00 $", nouvelle: "100.00 $", creeLe: new Date(approuveLe.getTime() - 5 * 60000) });
    journal.push({ jour: precedente.debut, action: "VERROUILLAGE", nouvelle: `Période du ${precedente.debut} au ${precedente.fin} approuvée et verrouillée`, creeLe: approuveLe });
    await prisma.correctionQuart.createMany({ data: journal.map((l) => ({ ...l, parNom: AUTEUR_QUARTS_DEMO })) });
    const periode = await prisma.periodeTemps.create({
      data: { debut: precedente.debut, fin: precedente.fin, statut: "VERROUILLEE", primes: { [marco.id]: 100 }, approuvePar: AUTEUR_QUARTS_DEMO, approuveLe },
    });
    ids.periodes.push(periode.id);
    await noterIds(ids);

    return { employes: employes.length, quarts: quarts.length };
  } catch (e) {
    console.error("Pointage de démonstration : échec du chargement", e);
    await noterIds(ids);
    await retirerQuartsDemo().catch((e2) => console.error("Pointage de démonstration : échec du nettoyage", e2));
    return { erreur: `Le chargement a échoué : ${String(e.message || e).split("\n")[0]}` };
  }
}

// ---------- Retrait ----------

// Retire les employés de démonstration avec leurs quarts, leur temps (bons de
// démonstration et tâche interne), leur journal de corrections, les périodes
// de démonstration et le client « flotte de démonstration » avec ses bons.
// Un employé de démonstration qui a servi à un vrai dossier ne se supprime
// pas : il est désactivé.
// → { employes, quarts, gardes } ou { erreur }
export async function retirerQuartsDemo() {
  const ids = await lireIds();
  if (!ids) return { erreur: "Le pointage de démonstration n'est pas chargé." };

  const bons = await prisma.bonTravail.findMany({
    where: { clientId: { in: ids.clients } },
    select: { id: true, numero: true, facture: { select: { numero: true } }, problemes: { select: { pieces: true } } },
  });
  const facture = bons.find((b) => b.facture);
  if (facture) return { erreur: `Le bon de démonstration #${facture.numero} a été facturé (${facture.facture.numero}) : annule d'abord cette facture.` };

  const quarts = await prisma.$transaction(async (tx) => {
    // Pièces mises sur un bon de démonstration pendant les essais : elles reviennent en stock
    for (const bon of bons) {
      for (const ligne of bon.problemes.flatMap((p) => p.pieces)) {
        await remettreLigneEnStock(tx, ligne, { note: `Bon #${bon.numero} retiré (démonstration)`, creePar: AUTEUR_QUARTS_DEMO });
      }
    }
    const bonIds = bons.map((b) => b.id);
    await tx.depotClient.deleteMany({ where: { bonId: { in: bonIds } } });
    await tx.rendezVous.deleteMany({ where: { OR: [{ bonId: { in: bonIds } }, { clientId: { in: ids.clients } }] } });
    await tx.soumission.deleteMany({ where: { OR: [{ bonId: { in: bonIds } }, { clientId: { in: ids.clients } }] } });
    await tx.creditClient.deleteMany({ where: { clientId: { in: ids.clients } } });
    await tx.bonTravail.deleteMany({ where: { id: { in: bonIds } } });
    await tx.client.deleteMany({ where: { id: { in: ids.clients } } });
    await tx.entreeTempsInterne.deleteMany({ where: { OR: [{ employeId: { in: ids.employes } }, { tacheInterneId: { in: ids.taches } }] } });
    await tx.tacheInterne.deleteMany({ where: { id: { in: ids.taches } } });
    const { count } = await tx.quart.deleteMany({ where: { employeId: { in: ids.employes } } });
    await tx.correctionQuart.deleteMany({ where: { OR: [{ employeId: { in: ids.employes } }, { parNom: AUTEUR_QUARTS_DEMO }] } });
    await tx.periodeTemps.deleteMany({ where: { id: { in: ids.periodes } } });
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
  await prisma.parametre.deleteMany({ where: { cle: CLE_QUARTS_DEMO } });
  return { employes, quarts, gardes };
}
