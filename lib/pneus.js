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
// Règles et libellés communs avec le navigateur : lib/pneusCalculs.js.
import { prisma } from "./prisma";
import { lireParametre } from "./parametres";
import { aAccesSection } from "./auth";
import { prochainNumero, creerAvecNumero } from "./numerotation";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "./bons";
import { obtenirInfosEntreprise } from "./config";
import { libelleVehicule } from "./vehicules";
import { courrielConfigure, courrielValide, preparerCourriel, envoyerCourriels } from "./courrielDocuments";
import { lireReglagesRappels } from "./rappelsEntretien";
import { SAISONS, libelleJeuMinuscule, saisonAVenir, normaliserJeu, normaliserUsure } from "./pneusCalculs";

export const CLE_MODULE_PNEUS = "module_pneus";
export const CLE_PRIX_SAISON = "pneus_prix_saison";
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

// Adresse de la fiche d'un jeu, encodée dans le QR de ses étiquettes
export const urlJeu = (base, id) => `${base}/pneus/${id}`;

const auteur = (session) => session?.nom || null;

// Nouveau jeu. statut : "ENTREPOSE" (emplacement exigé) ou "POSE" (sur le
// véhicule, pour suivre le jeu de l'autre saison). → le jeu, ou { erreur }
export async function creerJeu({ clientId, vehiculeId, brut, statut = "ENTREPOSE", bonId = null, session, tx = prisma }) {
  const { data, erreur } = normaliserJeu(brut);
  if (erreur) return { erreur };
  if (!["ENTREPOSE", "POSE"].includes(statut)) return { erreur: "État invalide." };
  if (statut === "ENTREPOSE" && !data.emplacement) return { erreur: "Indique l'emplacement à l'entrepôt (ex. A-12)." };
  const client = await tx.client.findUnique({ where: { id: String(clientId || "") }, select: { id: true } });
  if (!client) return { erreur: "Choisis le client." };
  if (vehiculeId) {
    const v = await tx.vehicule.findFirst({ where: { id: vehiculeId, clientId: client.id }, select: { id: true } });
    if (!v) return { erreur: "Ce véhicule n'est pas au dossier de ce client." };
  }
  return creerAvecNumero(
    () => prochainNumero(tx.jeuPneus, "numero", "PN"),
    (numero) => tx.jeuPneus.create({
      data: {
        ...data, numero, clientId: client.id, vehiculeId: vehiculeId || null, statut,
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
export async function bougerJeu(jeuId, action, { emplacement, usure, note, bonId = null, session }, tx = prisma) {
  const jeu = await tx.jeuPneus.findUnique({ where: { id: jeuId } });
  if (!jeu) return { erreur: "Jeu de pneus introuvable.", status: 404 };
  const place = String(emplacement ?? "").replace(/\s+/g, " ").trim().toUpperCase().slice(0, 30) || null;
  const remarque = String(note ?? "").trim().slice(0, 300) || null;
  const usureLue = normaliserUsure(usure);
  const mouvement = { bonId, employeNom: auteur(session), note: remarque };

  let data;
  if (action === "sortir") {
    if (jeu.statut !== "ENTREPOSE") return { erreur: "Ce jeu n'est pas à l'entrepôt.", status: 409 };
    data = { statut: "POSE", emplacement: null, mouvements: { create: { ...mouvement, type: "SORTIE", emplacement: jeu.emplacement } } };
  } else if (action === "entreposer") {
    if (jeu.statut === "ENTREPOSE") return { erreur: "Ce jeu est déjà à l'entrepôt.", status: 409 };
    if (!place) return { erreur: "Indique l'emplacement à l'entrepôt (ex. A-12).", status: 400 };
    data = {
      statut: "ENTREPOSE", emplacement: place, ...(usureLue && { usure: usureLue }),
      mouvements: { create: { ...mouvement, type: "ENTREE", emplacement: place, usure: usureLue } },
    };
  } else if (action === "remettre") {
    if (jeu.statut === "REMIS") return { erreur: "Ce jeu est déjà remis au client.", status: 409 };
    data = { statut: "REMIS", emplacement: null, mouvements: { create: { ...mouvement, type: "REMISE", emplacement: jeu.emplacement } } };
  } else if (action === "deplacer") {
    if (jeu.statut !== "ENTREPOSE") return { erreur: "Seul un jeu à l'entrepôt change d'emplacement.", status: 409 };
    if (!place || place === jeu.emplacement) return { erreur: "Indique le nouvel emplacement.", status: 400 };
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
export async function changementDeSaison({ bonId, sortirId, entrerId, nouveau, emplacement, usure, tache, facturer, session }) {
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
      jeuEntre = await bougerJeu(entrant.id, "entreposer", { emplacement: place, usure, bonId: bon.id, session }, tx);
    } else if (nouveau) {
      jeuEntre = await creerJeu({ clientId: bon.clientId, vehiculeId: bon.vehiculeId, brut: { ...nouveau, emplacement: place, usure: usure ?? nouveau.usure }, bonId: bon.id, session, tx });
    }
    if (jeuEntre?.erreur) throw new Error(jeuEntre.erreur);
    if (jeuEntre) faits.push(`entreposage des ${libelleJeuMinuscule(jeuEntre)} (${jeuEntre.numero}, ${jeuEntre.emplacement})`);

    const creees = [];
    if (tache && faits.length) {
      const texte = `Changement de pneus : ${faits.join(", ")}`;
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

// ---------- Rappels de changement de saison ----------

// Texte du rappel à un client pour ses jeux de la saison qui vient
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
  return {
    sujet: hiver ? `C'est le temps des pneus d'hiver — ${entreprise.nomEntreprise}` : `C'est le temps des pneus d'été — ${entreprise.nomEntreprise}`,
    texte: `Bonjour ${nomClient},\n\n${intro}\n\n${sesPneus} :\n${lignes.join("\n")}\n\n${contact}\n\nMerci de votre confiance,\n${entreprise.nomEntreprise}`,
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
  const [entreprise, { lien }] = await Promise.all([obtenirInfosEntreprise(), lireReglagesRappels()]);
  const groupes = [...parClient.values()];
  const { envoyes, echecs } = await envoyerCourriels(groupes.map(({ client, jeux: js }) => {
    const { sujet, texte } = texteRappelPneus({ nomClient: client.nom, jeux: js, aVenir, entreprise, lien });
    return preparerCourriel({ a: client.courriel, sujet, texte, entreprise, clientId: client.id });
  }));
  const rates = new Set(echecs.map((e) => e.a));
  const ids = groupes.filter((g) => !rates.has(g.client.courriel)).flatMap((g) => g.jeux.map((j) => j.id));
  if (ids.length) await prisma.jeuPneus.updateMany({ where: { id: { in: ids } }, data: { rappelLe: new Date() } });
  return { envoyes, sautes, echecs };
}
