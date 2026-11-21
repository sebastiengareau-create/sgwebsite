// Portail client (module « module_portail_client », actif par défaut ;
// Administrateur → Modules). Chaque client peut recevoir un lien secret
// (/portail-client/<jeton>) vers son dossier : ce qu'il doit, ses travaux en
// cours, les soumissions et rapports d'inspection qui attendent sa réponse,
// ses rendez-vous, ses véhicules (points à surveiller, pneus entreposés) et
// l'historique de ses factures, en PDF. Il paie en ligne si le paiement en
// ligne est actif, et choisit s'il reçoit les promotions par courriel.
//
// Le lien se crée, s'envoie (courriel ou texto) et se retire depuis la
// fiche du client. Un nouveau lien rend l'ancien inutilisable.
import crypto from "crypto";
import { prisma } from "./prisma";
import { lireParametre } from "./parametres";
import { obtenirInfosEntreprise } from "./config";
import { libelleVehicule } from "./vehicules";
import { soldeFacture } from "./paiementsFactures";
import { paiementEnLigneActif, assurerLienPaiement } from "./paiementEnLigne";
import { inspectionActive, pointsARevoir } from "./rappelsInspection";
import { pneusActif } from "./pneus";
import { libelleJeu } from "./pneusCalculs";
import { lienSoumission } from "./approbationSoumission";
import { preparerCourriel, envoyerCourriels, courrielConfigure, courrielValide } from "./courrielDocuments";

export const CLE_MODULE_PORTAIL = "module_portail_client";

export async function portailActif() {
  return (await lireParametre(CLE_MODULE_PORTAIL)) !== "inactif";
}

const adressePublique = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
export const nouveauJeton = () => crypto.randomBytes(24).toString("base64url");
export const lienPortailClient = (jeton) => `${adressePublique()}/portail-client/${jeton}`;
const lienInspection = (jeton) => `${adressePublique()}/inspection/${jeton}`;

// Client d'un lien de portail (module actif) → ou null
export async function clientParJeton(jeton) {
  if (!jeton || typeof jeton !== "string" || jeton.length < 20) return null;
  if (!(await portailActif())) return null;
  return prisma.client.findUnique({ where: { jetonPortail: jeton } });
}

const iso = (d) => (d ? new Date(d).toISOString() : null);

// Tout ce que le portail montre au client, en données simples
export async function donneesPortail(client) {
  const maintenant = new Date();
  const [vehicules, bons, soumissions, rendezVous, paiementActif, avecPneus, avecInspection] = await Promise.all([
    prisma.vehicule.findMany({ where: { clientId: client.id, vehiculeVente: { is: null } }, orderBy: { creeLe: "desc" } }),
    prisma.bonTravail.findMany({
      where: { clientId: client.id },
      orderBy: { creeLe: "desc" },
      take: 80,
      include: {
        vehicule: true,
        facture: true,
        problemes: { select: { description: true }, orderBy: { id: "asc" } },
        inspections: { where: { statut: "TERMINEE", jetonClient: { not: null } }, select: { id: true, titre: true, jetonClient: true, termineeLe: true, creeLe: true, reponseClient: true } },
      },
    }),
    prisma.soumission.findMany({
      where: { clientId: client.id, statut: "EN_ATTENTE", jetonClient: { not: null } },
      orderBy: { creeLe: "desc" },
      select: { id: true, numero: true, creeLe: true, jetonClient: true, reponseClient: true, vehiculeInfo: true, vehicule: true },
    }),
    prisma.rendezVous.findMany({ where: { clientId: client.id, statut: "CONFIRME", date: { gte: maintenant } }, orderBy: { date: "asc" }, take: 5 }),
    paiementEnLigneActif(),
    pneusActif(),
    inspectionActive(),
  ]);

  // Factures (les annulées ne paraissent pas) et ce qui reste à payer
  const factures = [];
  for (const b of bons) {
    const f = b.facture;
    if (!f || f.statut === "ANNULEE") continue;
    const solde = soldeFacture(f);
    factures.push({
      id: f.id, numero: f.numero, date: iso(f.dateEmission), total: f.totalAvecTaxes, solde,
      payee: f.statut === "PAYEE", bonNumero: b.numero, vehicule: b.vehicule ? libelleVehicule(b.vehicule) : "",
      lienPaiement: solde > 0.005 && paiementActif ? await assurerLienPaiement(f.id) : null,
    });
  }

  // Travaux en cours : bons pas encore facturés (pas les factures comptoir)
  const enCours = bons
    .filter((b) => !b.facture && b.statut !== "TERMINE" && !b.comptoir)
    .map((b) => ({
      id: b.id, numero: b.numero, statut: b.statut, date: iso(b.datePrevue || b.creeLe),
      vehicule: b.vehicule ? libelleVehicule(b.vehicule) : "",
      taches: b.problemes.map((p) => p.description).filter(Boolean).slice(0, 6),
    }));

  // Rapports d'inspection envoyés au client
  const inspections = avecInspection
    ? bons.flatMap((b) => b.inspections.map((i) => ({
      id: i.id, titre: i.titre, date: iso(i.termineeLe || i.creeLe), aRepondre: !i.reponseClient,
      vehicule: b.vehicule ? libelleVehicule(b.vehicule) : "", lien: lienInspection(i.jetonClient),
    })))
    : [];

  const vehiculeIds = vehicules.map((v) => v.id);
  const [points, jeux] = await Promise.all([
    avecInspection ? pointsARevoir(vehiculeIds) : new Map(),
    avecPneus ? prisma.jeuPneus.findMany({ where: { clientId: client.id, statut: { in: ["ENTREPOSE", "POSE"] } }, orderBy: { numero: "asc" } }) : [],
  ]);
  const derniereVisite = new Map();
  for (const b of bons) {
    if (b.vehiculeId && !derniereVisite.has(b.vehiculeId)) derniereVisite.set(b.vehiculeId, iso(b.creeLe));
  }

  return {
    client: { nom: client.nom, telephone: client.telephone, courriel: client.courriel, adresse: client.adresse, ville: client.ville, promotions: !client.promotionsRefuseesLe },
    aPayer: factures.filter((f) => f.solde > 0.005),
    factures,
    enCours,
    soumissions: soumissions.map((s) => ({
      id: s.id, numero: s.numero, date: iso(s.creeLe), aRepondre: !s.reponseClient, reponse: s.reponseClient,
      vehicule: s.vehicule ? libelleVehicule(s.vehicule) : s.vehiculeInfo || "", lien: lienSoumission(s.jetonClient),
    })),
    inspections,
    rendezVous: rendezVous.map((r) => ({ id: r.id, date: iso(r.date), motif: r.motif, vehicule: r.vehiculeInfo || "" })),
    vehicules: vehicules.map((v) => ({
      id: v.id, libelle: libelleVehicule(v), plaque: v.plaque || "", kilometrage: v.kilometrage, derniereVisite: derniereVisite.get(v.id) || null,
      aSurveiller: (points.get(v.id) || []).map((p) => ({ libelle: p.libelle, etat: p.etat, recommandation: p.recommandation, date: iso(p.date) })),
      pneus: jeux.filter((j) => j.vehiculeId === v.id).map((j) => ({ numero: j.numero, libelle: libelleJeu(j), statut: j.statut })),
    })),
    pneusSansVehicule: jeux.filter((j) => !j.vehiculeId || !vehiculeIds.includes(j.vehiculeId)).map((j) => ({ numero: j.numero, libelle: libelleJeu(j), statut: j.statut })),
    paiementActif,
  };
}

// Facture du client (pour son PDF) → l'id du bon, ou null si elle n'est pas à lui
export async function bonDeFactureDuClient(clientId, factureId) {
  const f = await prisma.facture.findUnique({ where: { id: factureId }, select: { bonId: true, statut: true, numero: true, bon: { select: { clientId: true } } } });
  return f && f.bon.clientId === clientId && f.statut !== "ANNULEE" ? f : null;
}

// Envoie le lien du portail au client par courriel. Lance une erreur si
// l'envoi est impossible.
export async function envoyerLienPortailClient(client) {
  if (!courrielConfigure()) throw new Error("L'envoi de courriel n'est pas configuré.");
  if (!courrielValide(client.courriel)) throw new Error("Ce client n'a pas de courriel valide.");
  if (!client.jetonPortail) throw new Error("Crée d'abord le lien du portail.");
  const entreprise = await obtenirInfosEntreprise();
  const prenom = String(client.nom || "").trim().split(/\s+/)[0];
  const texte = [
    `Bonjour ${prenom},`,
    "",
    `Voici le lien de votre dossier en ligne chez ${entreprise.nomEntreprise}. Vous y trouverez vos véhicules, vos factures (en PDF), les travaux en cours, vos rendez-vous, et les soumissions ou rapports d'inspection qui attendent votre réponse.`,
    "",
    lienPortailClient(client.jetonPortail),
    "",
    "Ce lien vous est personnel : ne le partagez pas.",
    ...(entreprise.telephone ? ["", `Pour toute question : ${entreprise.telephone}`] : []),
  ].join("\n");
  const { echecs } = await envoyerCourriels([preparerCourriel({ a: client.courriel, sujet: `Votre dossier en ligne — ${entreprise.nomEntreprise}`, texte, entreprise })]);
  if (echecs.length) throw new Error(echecs[0].erreur || "Le courriel n'a pas pu être envoyé.");
}
