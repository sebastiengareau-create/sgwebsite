// Élevage — module « Élevage » (Administrateur → Modules), inactif tant que
// le super-administrateur ne l'active pas. Conçu pour un élevage de bœuf
// wagyu, de la naissance à la table :
//
//   1. Troupeau : chaque bête (BT-001) avec sa mère, sa génétique, ses
//      pesées (gain moyen quotidien) et ses frais (coût de revient).
//   2. Abattage : poids de carcasse froide → paquets attendus de chaque
//      coupe selon les rendements (CoupeViande), puis les paquets réellement
//      reçus du boucher, en lots (LotViande) reliés à la bête.
//   3. Vente : paquets vendus en boutique ou en ligne, pris dans les lots
//      les plus anciens d'abord — chaque paquet reste relié à sa bête.
//
// Il cohabite avec l'inventaire de pièces (section à part, accès « Élevage »
// dans Rôles et accès) ou le remplace : décocher « Inventaire » des rôles.
// Calculs sans base de données : lib/elevageCalculs.js.
import { prisma } from "./prisma";
import { lireParametre } from "@/lib/parametres";
import { aAccesSection, obtenirSession } from "./auth";
import { prochainNumero } from "./numerotation";
import { CATEGORIES_FRAIS, CANAUX, GENETIQUES, SEXES, RENDEMENT_CARCASSE_DEFAUT } from "./elevageCalculs";

export const CLE_MODULE = "module_elevage";
const CLE_RENDEMENT_CARCASSE = "elevage_rendement_carcasse";

export async function elevageActif() {
  return (await lireParametre(CLE_MODULE)) === "actif";
}

export async function peutGererElevage(session) {
  return (await elevageActif()) && (await aAccesSection(session, "elevage"));
}

// Pour les routes d'API : la session si elle peut gérer l'élevage, sinon null
export async function sessionElevage() {
  const session = await obtenirSession();
  return (await peutGererElevage(session)) ? session : null;
}

export function prochainNumeroBete() {
  return prochainNumero(prisma.bete, "numero", "BT");
}

export async function lireRendementCarcasse() {
  const p = await prisma.parametre.findUnique({ where: { cle: CLE_RENDEMENT_CARCASSE } });
  const n = Number(p?.valeur);
  return Number.isFinite(n) && n > 0 ? n : RENDEMENT_CARCASSE_DEFAUT;
}

export async function ecrireRendementCarcasse(valeur) {
  await prisma.parametre.upsert({
    where: { cle: CLE_RENDEMENT_CARCASSE },
    update: { valeur: String(valeur) },
    create: { cle: CLE_RENDEMENT_CARCASSE, valeur: String(valeur) },
  });
}

// Coupes de départ, créées au premier affichage si le catalogue est vide :
// rendements typiques d'une carcasse de bœuf (≈ 62 % en paquets, le reste en
// os, gras et pertes de parage). Prix à 0 : à fixer par l'entreprise. Tout
// se modifie dans Élevage → Coupes et rendements.
const COUPES_DEFAUT = [
  ["Entrecôte (faux-filet)", 3.5, 0.3],
  ["Contre-filet", 3.0, 0.3],
  ["Filet mignon", 1.5, 0.2],
  ["Surlonge", 4.0, 0.4],
  ["Bavette", 0.8, 0.4],
  ["Hampe", 0.5, 0.4],
  ["Rôti de palette", 6.0, 1.2],
  ["Pointe de poitrine (brisket)", 4.0, 1.5],
  ["Côtes courtes", 3.0, 0.8],
  ["Rôti de ronde", 8.0, 1.0],
  ["Jarret (osso buco)", 2.5, 0.8],
  ["Bœuf haché", 20.0, 0.5],
  ["Os à moelle / bouillon", 5.0, 1.0],
];

export async function assurerCoupesParDefaut() {
  if ((await prisma.coupeViande.count()) > 0) return;
  await prisma.coupeViande.createMany({
    data: COUPES_DEFAUT.map(([nom, rendement, poidsPaquet], i) => ({ nom, rendement, poidsPaquet, ordre: i })),
    skipDuplicates: true,
  });
}

// ---------- Validation des champs reçus ----------
// Chaque normaliseur → { data } prêt pour Prisma, ou { erreur }. Seuls les
// champs présents sont repris (modification partielle).

const nombre = (v) => {
  const texte = String(v ?? "").replace(",", ".").replace(/\s/g, "");
  return texte === "" ? null : Number(texte);
};
const arrondi = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const texte = (v, max = 200) => String(v ?? "").trim().slice(0, max) || null;

// « 2026-11-05 » → midi UTC (la même journée au Québec, quel que soit le fuseau)
function date(v, { obligatoire = false } = {}) {
  if (!v) return obligatoire ? { erreur: true } : { valeur: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { erreur: true };
  return { valeur: new Date(`${v}T12:00:00Z`) };
}

function montant(v, nom, { obligatoire = false, positif = false } = {}) {
  const n = nombre(v);
  if (n === null) return obligatoire ? { erreur: `Indique ${nom}.` } : { valeur: null };
  if (!Number.isFinite(n) || n < 0 || (positif && n === 0)) return { erreur: `${nom[0].toUpperCase()}${nom.slice(1)} invalide.` };
  return { valeur: arrondi(n) };
}

export function normaliserBete(e) {
  const data = {};
  for (const champ of ["identifiant", "nom", "pere", "provenance"]) if (e[champ] !== undefined) data[champ] = texte(e[champ]);
  if (e.notes !== undefined) data.notes = texte(e.notes, 4000);
  if (e.sexe !== undefined) {
    if (!SEXES.some((s) => s.code === e.sexe)) return { erreur: "Choisis le sexe." };
    data.sexe = e.sexe;
  }
  if (e.genetique !== undefined) {
    if (e.genetique && !GENETIQUES.some((g) => g.code === e.genetique)) return { erreur: "Génétique invalide." };
    data.genetique = e.genetique || null;
  }
  if (e.origine !== undefined) {
    if (!["NEE_ICI", "ACHETEE"].includes(e.origine)) return { erreur: "Origine invalide." };
    data.origine = e.origine;
  }
  if (e.pourcentageWagyu !== undefined) {
    const n = nombre(e.pourcentageWagyu);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100)) return { erreur: "Pourcentage wagyu invalide (0 à 100)." };
    data.pourcentageWagyu = n;
  }
  if (e.coutAcquisition !== undefined) {
    const m = montant(e.coutAcquisition, "le coût d'acquisition");
    if (m.erreur) return m;
    data.coutAcquisition = m.valeur || 0;
  }
  for (const [champ, nom] of [["dateNaissance", "Date de naissance"], ["dateAcquisition", "Date d'acquisition"]]) {
    if (e[champ] === undefined) continue;
    const d = date(e[champ]);
    if (d.erreur) return { erreur: `${nom} invalide.` };
    data[champ] = d.valeur;
  }
  if (e.mereId !== undefined) data.mereId = e.mereId || null;
  return { data };
}

// La mère choisie doit être une femelle du registre, autre que la bête
// elle-même → { } ou { erreur }
export async function verifierMere(mereId, beteId) {
  if (!mereId) return {};
  if (mereId === beteId) return { erreur: "Une bête ne peut pas être sa propre mère." };
  const mere = await prisma.bete.findUnique({ where: { id: mereId }, select: { sexe: true } });
  if (!mere) return { erreur: "Mère introuvable." };
  if (mere.sexe !== "FEMELLE") return { erreur: "La mère doit être une femelle." };
  return {};
}

// Sortie du troupeau autrement que par l'abattage (vente sur pied, mort), ou
// retour au troupeau
export function normaliserSortie(e) {
  if (e.statut === "ACTIVE") return { data: { statut: "ACTIVE", dateSortie: null, prixVente: null } };
  if (!["VENDUE", "MORTE"].includes(e.statut)) return { erreur: "Statut invalide." };
  const d = date(e.dateSortie, { obligatoire: true });
  if (d.erreur) return { erreur: "Indique la date." };
  const data = { statut: e.statut, dateSortie: d.valeur, prixVente: null };
  if (e.statut === "VENDUE") {
    const m = montant(e.prixVente, "le prix de vente", { obligatoire: true });
    if (m.erreur) return m;
    data.prixVente = m.valeur;
  }
  return { data };
}

export function normaliserPesee(e) {
  const d = date(e.date, { obligatoire: true });
  if (d.erreur) return { erreur: "Indique la date de la pesée." };
  const poids = nombre(e.poids);
  if (poids === null || !Number.isFinite(poids) || poids <= 0 || poids > 3000) return { erreur: "Poids invalide (kg)." };
  return { data: { date: d.valeur, poids: arrondi(poids, 1), note: texte(e.note) } };
}

export function normaliserFrais(e) {
  const d = date(e.date, { obligatoire: true });
  if (d.erreur) return { erreur: "Indique la date." };
  if (!CATEGORIES_FRAIS.some((c) => c.code === e.categorie)) return { erreur: "Choisis la catégorie." };
  const m = montant(e.montant, "le montant", { obligatoire: true, positif: true });
  if (m.erreur) return m;
  return { data: { date: d.valeur, categorie: e.categorie, description: texte(e.description), montant: m.valeur } };
}

export function normaliserAbattage(e) {
  const d = date(e.date, { obligatoire: true });
  if (d.erreur) return { erreur: "Indique la date d'abattage." };
  const carcasse = nombre(e.poidsCarcasse);
  if (carcasse === null || !Number.isFinite(carcasse) || carcasse <= 0 || carcasse > 2000) return { erreur: "Indique le poids de carcasse froide (kg)." };
  const vif = nombre(e.poidsVif);
  if (vif !== null && (!Number.isFinite(vif) || vif <= 0 || vif > 3000)) return { erreur: "Poids vif invalide (kg)." };
  const bms = nombre(e.bms);
  if (bms !== null && (!Number.isInteger(bms) || bms < 1 || bms > 12)) return { erreur: "BMS invalide (1 à 12)." };
  const frais = montant(e.fraisAbattage, "les frais d'abattage");
  if (frais.erreur) return frais;
  return {
    data: {
      date: d.valeur, abattoir: texte(e.abattoir), poidsVif: vif === null ? null : arrondi(vif, 1),
      poidsCarcasse: arrondi(carcasse, 1), bms, fraisAbattage: frais.valeur || 0, notes: texte(e.notes, 4000),
    },
  };
}

// Paquets reçus du boucher pour une coupe → { data: { nbPaquets, poidsTotal } }
export function normaliserLot(e) {
  const nb = nombre(e.nbPaquets);
  if (nb === null || !Number.isInteger(nb) || nb < 0) return { erreur: "Nombre de paquets invalide." };
  const poids = nombre(e.poidsTotal);
  if (poids === null || !Number.isFinite(poids) || poids < 0) return { erreur: "Poids total invalide (kg)." };
  return { data: { nbPaquets: nb, poidsTotal: arrondi(poids, 2) } };
}

export function normaliserCoupe(e) {
  const data = {};
  if (e.nom !== undefined) {
    const nom = texte(e.nom, 80);
    if (!nom) return { erreur: "Indique le nom de la coupe." };
    data.nom = nom;
  }
  if (e.rendement !== undefined) {
    const n = nombre(e.rendement);
    if (n === null || !Number.isFinite(n) || n < 0 || n > 100) return { erreur: "Rendement invalide (% de la carcasse, 0 à 100)." };
    data.rendement = arrondi(n, 2);
  }
  if (e.poidsPaquet !== undefined) {
    const n = nombre(e.poidsPaquet);
    if (n === null || !Number.isFinite(n) || n <= 0 || n > 50) return { erreur: "Poids d'un paquet invalide (kg)." };
    data.poidsPaquet = arrondi(n, 3);
  }
  for (const [champ, nom] of [["prixBoutique", "le prix en boutique"], ["prixEnLigne", "le prix en ligne"]]) {
    if (e[champ] === undefined) continue;
    const m = montant(e[champ], nom);
    if (m.erreur) return m;
    data[champ] = m.valeur || 0;
  }
  for (const champ of ["enLigne", "actif"]) if (e[champ] !== undefined) data[champ] = Boolean(e[champ]);
  if (e.ordre !== undefined && Number.isInteger(e.ordre)) data.ordre = e.ordre;
  return { data };
}

// ---------- Vente de paquets ----------

// Vend des paquets d'une coupe : pris dans les lots les plus anciens
// (abattage le plus tôt) d'abord, une VenteViande par lot touché pour que
// chaque paquet reste relié à sa bête. Poids et montant répartis selon le
// nombre de paquets ; sans poids, le poids moyen des paquets du lot ; sans
// montant, poids × prix au kg du canal.
// → { ventes } ou { erreur }
export async function vendrePaquets({ coupeId, canal, nbPaquets, poids, montant: montantSaisi, date: dateSaisie, note }, creePar) {
  if (!CANAUX.some((c) => c.code === canal)) return { erreur: "Choisis le canal de vente." };
  const nb = nombre(nbPaquets);
  if (nb === null || !Number.isInteger(nb) || nb <= 0) return { erreur: "Nombre de paquets invalide." };
  const d = date(dateSaisie, { obligatoire: true });
  if (d.erreur) return { erreur: "Indique la date de la vente." };
  const poidsSaisi = nombre(poids);
  if (poidsSaisi !== null && (!Number.isFinite(poidsSaisi) || poidsSaisi <= 0)) return { erreur: "Poids invalide (kg)." };
  const m = montant(montantSaisi, "le montant");
  if (m.erreur) return m;

  return prisma.$transaction(async (tx) => {
    const coupe = await tx.coupeViande.findUnique({ where: { id: coupeId } });
    if (!coupe) return { erreur: "Coupe introuvable." };
    const lots = await tx.lotViande.findMany({
      where: { coupeId },
      include: { ventes: { select: { nbPaquets: true, poids: true } }, abattage: { select: { date: true } } },
      orderBy: [{ abattage: { date: "asc" } }, { id: "asc" }],
    });
    const prises = [];
    let reste = nb;
    for (const lot of lots) {
      if (reste === 0) break;
      const vendus = lot.ventes.reduce((s, v) => s + v.nbPaquets, 0);
      const dispo = lot.nbPaquets - vendus;
      if (dispo <= 0) continue;
      const qte = Math.min(dispo, reste);
      prises.push({ lot, qte });
      reste -= qte;
    }
    if (reste > 0) return { erreur: `Il ne reste que ${nb - reste} paquet${nb - reste > 1 ? "s" : ""} de ${coupe.nom} en stock.` };

    const prix = canal === "EN_LIGNE" ? coupe.prixEnLigne : coupe.prixBoutique;
    const ventes = [];
    let poidsRestant = poidsSaisi;
    let montantRestant = m.valeur;
    for (const [i, { lot, qte }] of prises.entries()) {
      const dernier = i === prises.length - 1;
      const poidsMoyen = lot.nbPaquets > 0 ? lot.poidsTotal / lot.nbPaquets : coupe.poidsPaquet;
      const p = poidsSaisi === null ? arrondi(poidsMoyen * qte, 3) : dernier ? arrondi(poidsRestant, 3) : arrondi((poidsSaisi * qte) / nb, 3);
      const mt = m.valeur === null ? arrondi(p * prix) : dernier ? arrondi(montantRestant) : arrondi((m.valeur * qte) / nb);
      if (poidsSaisi !== null) poidsRestant -= p;
      if (m.valeur !== null) montantRestant -= mt;
      ventes.push(await tx.venteViande.create({
        data: { lotId: lot.id, date: d.valeur, canal, nbPaquets: qte, poids: p, montant: mt, note: texte(note), creePar },
      }));
    }
    return { ventes };
  });
}
