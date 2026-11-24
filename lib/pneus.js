// Entreposage de pneus (module « module_pneus », inactif par défaut ;
// Administrateur → Modules) : les jeux de pneus des clients gardés à
// l'atelier d'une saison à l'autre (« hôtel à pneus »).
//
// Un jeu (JeuPneus, PN-001…) est à l'entrepôt à un emplacement, posé sur le
// véhicule, ou remis au client. Chaque geste laisse un mouvement
// (MouvementPneus). Sur un bon, « Changement de saison » pose le jeu
// entreposé et entrepose celui qui sort du véhicule, à l'emplacement libéré,
// en ajoutant au bon la tâche et le prix de l'entreposage. Chaque automne et
// chaque printemps, les clients dont les pneus de la saison qui vient sont à
// l'entrepôt reçoivent un rappel (courriel ou texto).
//
// Chaque jeu porte le détail pneu par pneu (position, usure, code DOT, pneu
// endommagé), d'où son état (bon, à surveiller, à remplacer — seuils
// réglables), et l'équipement de ses roues (clé antivol, capteurs, couple de
// serrage) rappelé à la pose. Le plan de l'entrepôt (rangées et places)
// propose les places libres et refuse une place déjà prise. Photos à
// l'entrée et reçu d'entreposage en PDF pour le client (lib/pdfRecuPneus.js).
//
// Règles et libellés communs avec le navigateur : lib/pneusCalculs.js.
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { lireParametre } from "./parametres";
import { aAccesSection } from "./auth";
import { prochainNumero, creerAvecNumero } from "./numerotation";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "./bons";
import { obtenirInfosEntreprise } from "./config";
import { libelleVehicule } from "./vehicules";
import { courrielConfigure, courrielValide, preparerCourriel, envoyerCourriels } from "./courrielDocuments";
import { genererPdfRecuPneus } from "./pdfRecuPneus";
import { lireReglagesRappels } from "./rappelsEntretien";
import {
  SAISONS, ANTIVOL, JANTES, libelleJeu, libelleJeuMinuscule, libellePosition, saisonAVenir, pneusDuJeu, ageDot, resumeEquipement, normaliserJeu, normaliserUsure, appliquerUsures, evaluerJeu,
  normaliserPlan, normaliserSeuils, canoniserEmplacement, cleEmplacement, SEUILS_PNEUS_DEFAUT, CONDITIONS_RECU_DEFAUT,
} from "./pneusCalculs";

export const CLE_MODULE_PNEUS = "module_pneus";
export const CLE_PRIX_SAISON = "pneus_prix_saison";
export const CLE_PLAN = "pneus_entrepot"; // plan de l'entrepôt (JSON : { rangees })
export const CLE_SEUILS = "pneus_seuils"; // seuils de l'état d'un jeu (JSON)
export const CLE_CONDITIONS = "pneus_conditions"; // conditions imprimées sur le reçu
// Poste de revenu de l'entreposage (plan comptable, lib/comptabilite.js)
export const POSTE_ENTREPOSAGE = "4040";

export async function pneusActif() {
  return (await lireParametre(CLE_MODULE_PNEUS)) === "actif";
}

// Refus d'une page ou d'une route → { erreur, status }, ou null si permis :
// module actif et section « Entreposage de pneus » (Rôles et accès)
export async function refusPneus(session) {
  if (!session) return { erreur: "Non connecté.", status: 401 };
  if (!(await pneusActif())) return { erreur: "Le module Entreposage de pneus est désactivé (Administrateur → Modules).", status: 403 };
  if (!(await aAccesSection(session, "pneus"))) return { erreur: "Accès refusé.", status: 403 };
  return null;
}

// Prix de l'entreposage d'un jeu pour une saison (Entreposage de pneus →
// Réglages) ; null : pas de ligne ajoutée au bon
export async function lirePrixSaison() {
  const n = Number(String((await lireParametre(CLE_PRIX_SAISON)) ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

const lireJson = (texte) => { try { return JSON.parse(texte || "null"); } catch { return null; } };

// Plan de l'entrepôt ({ rangees: [] } : pas de plan)
export async function lirePlanEntrepot() {
  return normaliserPlan(lireJson(await lireParametre(CLE_PLAN))).plan || { rangees: [] };
}

// Seuils de l'état d'un jeu (usure et âge)
export async function lireSeuilsPneus() {
  return normaliserSeuils(lireJson(await lireParametre(CLE_SEUILS))).seuils || { ...SEUILS_PNEUS_DEFAUT };
}

// Conditions d'entreposage imprimées sur le reçu (texte par défaut si vide)
export async function lireConditionsRecu() {
  return String((await lireParametre(CLE_CONDITIONS)) ?? "").trim() || CONDITIONS_RECU_DEFAUT;
}

// Tous les réglages du module, pour la page et les formulaires
export async function lireReglagesPneus() {
  const [prixSaison, plan, seuils, conditions, conditionsPerso] = await Promise.all([
    lirePrixSaison(), lirePlanEntrepot(), lireSeuilsPneus(), lireConditionsRecu(), lireParametre(CLE_CONDITIONS),
  ]);
  return { prixSaison, plan, seuils, conditions, conditionsPersonnalisees: !!String(conditionsPerso ?? "").trim() };
}

// Emplacements des jeux à l'entrepôt (pour proposer les places libres)
export async function emplacementsOccupes() {
  const jeux = await prisma.jeuPneus.findMany({ where: { statut: "ENTREPOSE", emplacement: { not: null } }, select: { emplacement: true } });
  return jeux.map((j) => j.emplacement);
}

// Place où entre un jeu → { place } (le nom de la place du plan qui lui
// correspond), ou { erreur } si elle est déjà prise par un autre jeu
async function verifierPlace(texte, { saufId = null, tx = prisma } = {}) {
  const place = canoniserEmplacement(texte, await lirePlanEntrepot());
  if (!place) return { erreur: "Indique l'emplacement à l'entrepôt (ex. A-12)." };
  const cle = cleEmplacement(place);
  const occupants = await tx.jeuPneus.findMany({
    where: { statut: "ENTREPOSE", emplacement: { not: null }, ...(saufId && { id: { not: saufId } }) },
    select: { numero: true, emplacement: true, client: { select: { nom: true } } },
  });
  const pris = occupants.find((j) => cleEmplacement(j.emplacement) === cle);
  if (pris) return { erreur: `L'emplacement ${place} est déjà pris par ${pris.numero} (${pris.client.nom}). Choisis une place libre.` };
  return { place };
}

// Champs normalisés → données Prisma (le détail effacé : DbNull)
export const pourPrisma = (data) => (data.pneus === null ? { ...data, pneus: Prisma.DbNull } : data);

// Adresse de la fiche d'un jeu, encodée dans le QR de ses étiquettes
export const urlJeu = (base, id) => `${base}/pneus/${id}`;

const auteur = (session) => session?.nom || null;

// Nouveau jeu. statut : "ENTREPOSE" (emplacement exigé) ou "POSE" (sur le
// véhicule, pour suivre le jeu de l'autre saison). → le jeu, ou { erreur }
export async function creerJeu({ clientId, vehiculeId, brut, statut = "ENTREPOSE", bonId = null, session, tx = prisma }) {
  const { data, erreur } = normaliserJeu(brut);
  if (erreur) return { erreur };
  if (!["ENTREPOSE", "POSE"].includes(statut)) return { erreur: "État invalide." };
  if (statut === "ENTREPOSE") {
    const { place, erreur: prise } = await verifierPlace(data.emplacement, { tx });
    if (prise) return { erreur: prise };
    data.emplacement = place;
  }
  const client = await tx.client.findUnique({ where: { id: String(clientId || "") }, select: { id: true } });
  if (!client) return { erreur: "Choisis le client." };
  if (vehiculeId) {
    const v = await tx.vehicule.findFirst({ where: { id: vehiculeId, clientId: client.id }, select: { id: true } });
    if (!v) return { erreur: "Ce véhicule n'est pas au dossier de ce client." };
  }
  const { pneus, ...reste } = data;
  return creerAvecNumero(
    () => prochainNumero(tx.jeuPneus, "numero", "PN"),
    (numero) => tx.jeuPneus.create({
      data: {
        ...reste, ...(pneus && { pneus }), numero, clientId: client.id, vehiculeId: vehiculeId || null, statut,
        emplacement: statut === "ENTREPOSE" ? data.emplacement : null,
        mouvements: {
          create: statut === "ENTREPOSE"
            ? { type: "ENTREE", emplacement: data.emplacement, usure: data.usure, bonId, employeNom: auteur(session), note: "Premier entreposage" }
            : { type: "SORTIE", bonId, employeNom: auteur(session), note: "Inscrit sur le véhicule" },
        },
      },
    }),
  );
}

// Geste sur un jeu → le jeu mis à jour, ou { erreur, status }
//  - sortir : de l'entrepôt au véhicule ;
//  - entreposer : du véhicule (ou remis) à l'entrepôt, à un emplacement ;
//  - remettre : rendu au client (ou jeté) ;
//  - deplacer : nouvel emplacement à l'entrepôt.
// usures : nouvelles mesures pneu par pneu à l'entrée (dans l'ordre des
// positions, vide : inchangée) ; usure : la même chose en texte (« 8 8 7 7 »).
export async function bougerJeu(jeuId, action, { emplacement, usure, usures, note, bonId = null, session }, tx = prisma) {
  const jeu = await tx.jeuPneus.findUnique({ where: { id: jeuId } });
  if (!jeu) return { erreur: "Jeu de pneus introuvable.", status: 404 };
  const remarque = String(note ?? "").trim().slice(0, 300) || null;
  const mesures = Array.isArray(usures) ? usures : normaliserUsure(usure)?.split(", ");
  const mesure = mesures?.some((u) => String(u ?? "").trim()) ? appliquerUsures(jeu, mesures) : null;
  const mouvement = { bonId, employeNom: auteur(session), note: remarque };
  const placeLibre = async () => {
    if (!String(emplacement ?? "").trim()) return { erreur: action === "deplacer" ? "Indique le nouvel emplacement." : "Indique l'emplacement à l'entrepôt (ex. A-12)." };
    return verifierPlace(emplacement, { saufId: jeu.id, tx });
  };

  let data;
  if (action === "sortir") {
    if (jeu.statut !== "ENTREPOSE") return { erreur: "Ce jeu n'est pas à l'entrepôt.", status: 409 };
    data = { statut: "POSE", emplacement: null, mouvements: { create: { ...mouvement, type: "SORTIE", emplacement: jeu.emplacement } } };
  } else if (action === "entreposer") {
    if (jeu.statut === "ENTREPOSE") return { erreur: "Ce jeu est déjà à l'entrepôt.", status: 409 };
    const { place, erreur } = await placeLibre();
    if (erreur) return { erreur, status: 400 };
    data = {
      statut: "ENTREPOSE", emplacement: place, ...(mesure && { usure: mesure.usure, pneus: mesure.pneus }),
      mouvements: { create: { ...mouvement, type: "ENTREE", emplacement: place, usure: mesure?.usure || null } },
    };
  } else if (action === "remettre") {
    if (jeu.statut === "REMIS") return { erreur: "Ce jeu est déjà remis au client.", status: 409 };
    data = { statut: "REMIS", emplacement: null, mouvements: { create: { ...mouvement, type: "REMISE", emplacement: jeu.emplacement } } };
  } else if (action === "deplacer") {
    if (jeu.statut !== "ENTREPOSE") return { erreur: "Seul un jeu à l'entrepôt change d'emplacement.", status: 409 };
    const { place, erreur } = await placeLibre();
    if (erreur) return { erreur, status: 400 };
    if (cleEmplacement(place) === cleEmplacement(jeu.emplacement)) return { erreur: "Le jeu est déjà à cet emplacement.", status: 400 };
    data = { emplacement: place, mouvements: { create: { ...mouvement, type: "DEPLACEMENT", emplacement: place } } };
  } else {
    return { erreur: "Geste inconnu.", status: 400 };
  }
  return tx.jeuPneus.update({ where: { id: jeu.id }, data });
}

// Changement de saison sur un bon : le jeu entreposé (sortirId) est posé, et
// celui qui sort du véhicule entre à l'entrepôt — un jeu déjà suivi
// (entrerId, posé) ou un nouveau (nouveau : champs du jeu). emplacement :
// celui du jeu entrant (par défaut, celui libéré). tache : ajoute au bon la
// tâche du changement ; facturer : la ligne d'entreposage, au prix de la
// saison. → { taches } ou { erreur, status }
export async function changementDeSaison({ bonId, sortirId, entrerId, nouveau, emplacement, usure, usures, tache, facturer, session }) {
  const bon = await prisma.bonTravail.findUnique({ where: { id: String(bonId || "") }, select: { id: true, clientId: true, vehiculeId: true } });
  if (!bon) return { erreur: "Bon introuvable.", status: 404 };
  if (await bonEstVerrouille(bon.id)) return { erreur: MESSAGE_BON_VERROUILLE, status: 409 };
  if (!sortirId && !entrerId && !nouveau) return { erreur: "Rien à changer.", status: 400 };

  const duBon = async (id) => {
    const jeu = id ? await prisma.jeuPneus.findUnique({ where: { id } }) : null;
    if (id && (!jeu || jeu.clientId !== bon.clientId || (jeu.vehiculeId && bon.vehiculeId && jeu.vehiculeId !== bon.vehiculeId))) return false;
    return jeu;
  };
  const sortant = await duBon(sortirId);
  const entrant = await duBon(entrerId);
  if (sortant === false || entrant === false) return { erreur: "Ce jeu de pneus n'est pas celui de ce client ou de ce véhicule.", status: 400 };
  if (sortant && sortant.statut !== "ENTREPOSE") return { erreur: `${sortant.numero} n'est pas à l'entrepôt.`, status: 409 };
  if (entrant && entrant.statut === "ENTREPOSE") return { erreur: `${entrant.numero} est déjà à l'entrepôt.`, status: 409 };
  const place = String(emplacement ?? "").trim() || sortant?.emplacement || "";
  const prix = facturer ? await lirePrixSaison() : null;

  const taches = await prisma.$transaction(async (tx) => {
    const faits = [];
    if (sortant) {
      const r = await bougerJeu(sortant.id, "sortir", { bonId: bon.id, session }, tx);
      if (r.erreur) throw new Error(r.erreur);
      faits.push(`pose des ${libelleJeuMinuscule(sortant)} (${sortant.numero})`);
    }
    let jeuEntre = null;
    if (entrant) {
      jeuEntre = await bougerJeu(entrant.id, "entreposer", { emplacement: place, usure, usures, bonId: bon.id, session }, tx);
    } else if (nouveau) {
      jeuEntre = await creerJeu({ clientId: bon.clientId, vehiculeId: bon.vehiculeId, brut: { ...nouveau, emplacement: place, usure: usure ?? nouveau.usure }, bonId: bon.id, session, tx });
    }
    if (jeuEntre?.erreur) throw new Error(jeuEntre.erreur);
    if (jeuEntre) faits.push(`entreposage des ${libelleJeuMinuscule(jeuEntre)} (${jeuEntre.numero}, ${jeuEntre.emplacement})`);

    const creees = [];
    if (tache && faits.length) {
      // Pour le mécanicien : la clé antivol et le serrage du jeu posé
      const rappels = sortant ? [
        sortant.antivol && ANTIVOL[sortant.antivol].toLowerCase(),
        sortant.couple && `serrage à ${sortant.couple} lb-pi, à revérifier après 50 à 100 km`,
      ].filter(Boolean) : [];
      const aRappeler = rappels.join(" ; ");
      const texte = `Changement de pneus : ${faits.join(", ")}${aRappeler ? `. ${aRappeler.charAt(0).toUpperCase()}${aRappeler.slice(1)}` : ""}`;
      creees.push(await tx.probleme.create({ data: { description: texte.charAt(0).toUpperCase() + texte.slice(1), bonId: bon.id }, select: { id: true, description: true } }));
    }
    if (prix && jeuEntre) {
      const saison = SAISONS[jeuEntre.saison]?.deSaison || "";
      creees.push(await tx.probleme.create({
        data: {
          description: `Entreposage des pneus ${saison} (${jeuEntre.numero})`, bonId: bon.id,
          categorieRevenu: POSTE_ENTREPOSAGE, factureDescription: "Entreposage de pneus — saison", facturePrixUnitaire: prix, factureQte: 1,
        },
        select: { id: true, description: true },
      }));
    }
    return creees;
  }).catch((e) => ({ erreur: e.message }));
  if (taches.erreur) return { erreur: taches.erreur, status: 400 };
  return { taches };
}

// ---------- Reçu d'entreposage ----------

// Reçu d'entreposage d'un jeu (PDF) → { jeu, pdf, entreprise }, ou null si
// le jeu n'existe pas. Daté de la dernière entrée à l'entrepôt.
export async function genererRecuPneus(jeuId) {
  const jeu = await prisma.jeuPneus.findUnique({
    where: { id: String(jeuId || "") },
    include: {
      client: { select: { nom: true, telephone: true, courriel: true, adresse: true, ville: true, province: true, codePostal: true } },
      vehicule: true,
      mouvements: { where: { type: "ENTREE" }, orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
  });
  if (!jeu) return null;
  const [entreprise, seuils, conditions, prixSaison] = await Promise.all([obtenirInfosEntreprise(), lireSeuilsPneus(), lireConditionsRecu(), lirePrixSaison()]);
  const detail = pneusDuJeu(jeu);
  const pdf = await genererPdfRecuPneus({
    jeu, detail, etat: evaluerJeu(jeu, seuils), equipement: resumeEquipement(jeu), libelle: libelleJeu(jeu), jantes: JANTES[jeu.jantes],
    ages: detail.map((p) => ageDot(p.dot)), date: jeu.mouvements[0]?.date || jeu.creeLe, prixSaison, conditions, libellePosition,
  }, entreprise);
  return { jeu, pdf, entreprise };
}

// ---------- Rappels de changement de saison ----------

// Texte du rappel à un client pour ses jeux de la saison qui vient
// jeux[].etat : état du jeu (evaluerJeu) ; un jeu à remplacer est signalé,
// avec l'offre d'une soumission pour des pneus neufs
export function texteRappelPneus({ nomClient, jeux, aVenir, entreprise, lien }) {
  const hiver = aVenir.saison === "HIVER";
  const intro = hiver
    ? "L'hiver approche : au Québec, les pneus d'hiver doivent être posés au plus tard le 1er décembre."
    : "Le printemps arrive : vous pourrez remettre vos pneus d'été à partir du 16 mars.";
  const lignes = jeux.map((j) => `• ${j.vehicule ? `${libelleVehicule(j.vehicule)} : ` : ""}${libelleJeuMinuscule(j)} (${j.numero})`);
  const contact = [
    lien && `Pour prendre rendez-vous en ligne : ${lien}`,
    entreprise.telephone && `${lien ? "Ou appelez-nous" : "Pour prendre rendez-vous, appelez-nous"} au ${entreprise.telephone}.`,
    !lien && !entreprise.telephone && "Pour prendre rendez-vous, répondez simplement à ce courriel.",
  ].filter(Boolean).join("\n");
  const sesPneus = jeux.length > 1 ? "Vos pneus sont entreposés chez nous" : `Vos pneus ${SAISONS[aVenir.saison].deSaison} sont entreposés chez nous`;
  const aRemplacer = jeux.filter((j) => j.etat?.code === "REMPLACER");
  const pourquoi = (j) => j.etat.raisons.join(", ").toLowerCase();
  let remplacer = "";
  if (aRemplacer.length === 1 && jeux.length === 1) {
    remplacer = `\n\nLors de l'entreposage, nous avons noté que ces pneus sont à remplacer (${pourquoi(aRemplacer[0])}).`;
  } else if (aRemplacer.length) {
    remplacer = `\n\nLors de l'entreposage, nous avons noté que ces pneus sont à remplacer :\n${aRemplacer.map((j) => `• ${libelleJeuMinuscule(j)} (${j.numero}) : ${pourquoi(j)}`).join("\n")}`;
  }
  if (remplacer) remplacer += "\nNous pouvons vous préparer une soumission pour des pneus neufs, posés au même rendez-vous.";
  return {
    sujet: hiver ? `C'est le temps des pneus d'hiver — ${entreprise.nomEntreprise}` : `C'est le temps des pneus d'été — ${entreprise.nomEntreprise}`,
    texte: `Bonjour ${nomClient},\n\n${intro}\n\n${sesPneus} :\n${lignes.join("\n")}${remplacer}\n\n${contact}\n\nMerci de votre confiance,\n${entreprise.nomEntreprise}`,
  };
}

// Envoie le rappel par courriel pour ces jeux (un courriel par client) et le
// note sur les jeux. Message commercial : lien de désabonnement ; un client
// désabonné ou sans courriel est sauté. → { envoyes, sautes, echecs }
export async function envoyerRappelsPneus(jeuIds) {
  if (!courrielConfigure()) return { erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant)." };
  const aVenir = saisonAVenir();
  const jeux = await prisma.jeuPneus.findMany({
    where: { id: { in: jeuIds }, statut: "ENTREPOSE", saison: aVenir.saison },
    include: { client: { select: { id: true, nom: true, courriel: true, promotionsRefuseesLe: true } }, vehicule: true },
    orderBy: { numero: "asc" },
  });
  const parClient = new Map();
  let sautes = 0;
  for (const j of jeux) {
    const courriel = (j.client.courriel || "").trim();
    if (j.client.promotionsRefuseesLe || !courrielValide(courriel)) { sautes++; continue; }
    if (!parClient.has(j.client.id)) parClient.set(j.client.id, { client: { ...j.client, courriel }, jeux: [] });
    parClient.get(j.client.id).jeux.push(j);
  }
  if (parClient.size === 0) return { envoyes: 0, sautes, echecs: [] };
  const [entreprise, { lien }, seuils] = await Promise.all([obtenirInfosEntreprise(), lireReglagesRappels(), lireSeuilsPneus()]);
  const groupes = [...parClient.values()];
  const { envoyes, echecs } = await envoyerCourriels(groupes.map(({ client, jeux: js }) => {
    const avecEtat = js.map((j) => ({ ...j, etat: evaluerJeu(j, seuils) }));
    const { sujet, texte } = texteRappelPneus({ nomClient: client.nom, jeux: avecEtat, aVenir, entreprise, lien });
    return preparerCourriel({ a: client.courriel, sujet, texte, entreprise, clientId: client.id });
  }));
  const rates = new Set(echecs.map((e) => e.a));
  const ids = groupes.filter((g) => !rates.has(g.client.courriel)).flatMap((g) => g.jeux.map((j) => j.id));
  if (ids.length) await prisma.jeuPneus.updateMany({ where: { id: { in: ids } }, data: { rappelLe: new Date() } });
  return { envoyes, sautes, echecs };
}
