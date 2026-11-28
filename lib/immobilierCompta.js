// Immobilier relié à la comptabilité — option du forfait, activée seulement
// par le développeur ou le super-administrateur (Administrateur → Modules,
// sous Immobilier : Parametre « module_immobilier_comptabilite »), inactive
// par défaut : sans elle, le module reste autonome, comme avant. Le client
// règle ensuite la date de départ et le compte de banque (Immobilier →
// Comptabilité). Active (et le module Comptabilité aussi), à partir de la
// date de départ choisie :
//
//   1. Loyers et frais inscrits aux baux (ChargeImmo) : débit « Loyers à
//      recevoir », crédit « Revenus de location » (ou « Autres revenus de
//      location » pour les frais) — un crédit au bail fait l'inverse.
//   2. Paiements des locataires (PaiementImmo) : débit du compte de
//      trésorerie choisi (conciliation bancaire), crédit « Loyers à recevoir ».
//   3. Dépenses des immeubles (DepenseImmo) : facture du fournisseur aux
//      comptes à payer (Depense, origine IMMO_DEPENSE), payée là comme les
//      autres — ou tout de suite, « déjà payée » à la saisie.
//   4. Réparations terminées avec un coût réel (ReparationImmo) : facture de
//      l'entrepreneur aux comptes à payer (origine IMMO_REPARATION).
//   Travaux majeurs (catégorie « Travaux majeurs » ou réparation cochée
//   « dépense d'immobilisation ») : au compte d'actif « Immeubles —
//   améliorations », pas en dépense.
//
// Taxes : le loyer résidentiel est exonéré, la TPS et la TVQ payées sur les
// dépenses d'un immeuble ne sont donc pas récupérables — elles restent dans
// le montant de la dépense (aucun CTI ni RTI).
//
// L'Immobilier reste la source : synchroniserComptaImmo() compare ce qu'il
// contient à ce qui est aux livres et corrige l'écart (écriture ou facture
// créée, refaite si le montant, la date ou le fournisseur ont changé,
// retirée si l'élément a disparu). Elle est appelée après chaque
// modification de l'Immobilier, à la vérification quotidienne et depuis
// Immobilier → Comptabilité. Rien n'est touché dans une période verrouillée
// ou fermée, ni une écriture déjà conciliée : l'écart est signalé. Une
// facture déjà payée dont l'élément disparaît reste aux comptes à payer
// (détachée). Désactiver le lien arrête la synchronisation ; ce qui est aux
// livres y reste.
//
// Comptes et postes créés à la première activation seulement (jamais dans
// une installation qui ne s'en sert pas). Réglages du client : Parametre
// « immo_comptabilite » (JSON). Aucun réglage de profil.

export const CLE_OPTION = "module_immobilier_comptabilite";

import { prisma } from "./prisma";
import { lireParametre } from "./parametres";
import { prochainNumeroFournisseur, creerAvecNumero } from "./numerotation";
import {
  moduleComptabiliteActif, assurerPlanComptable, enregistrerEcriture, posterDepenseRecue, posterDepensePayee,
  verifierPeriodeModifiable, creerCompteAvecProchainNumero,
} from "./comptabilite";
import { CATEGORIES_DEPENSE, TYPES_CHARGE, libelle, nomLogement } from "./immobilierCalculs";

const CLE = "immo_comptabilite";
const CLE_DERNIER = "immo_comptabilite_dernier"; // JSON { le, lignes, erreurs } : affiché dans Immobilier → Comptabilité
export const ORIGINE_DEPENSE = "IMMO_DEPENSE";
export const ORIGINE_REPARATION = "IMMO_REPARATION";
const SOURCE_CHARGE = "IMMO_CHARGE";
const SOURCE_PAIEMENT = "IMMO_PAIEMENT";
const FOURNISSEUR_DIVERS = "Divers — immeubles";

// Comptes du plan comptable propres à la location (numéro souhaité : un
// autre est pris s'il est occupé par un compte différent)
const COMPTES = {
  aRecevoir: { numero: "1150", nom: "Loyers à recevoir", type: "ACTIF" },
  ameliorations: { numero: "1450", nom: "Immeubles — améliorations (immobilisations)", type: "ACTIF" },
  revenus: { numero: "4600", nom: "Revenus de location", type: "REVENU" },
  autresRevenus: { numero: "4610", nom: "Autres revenus de location", type: "REVENU" },
};

// Postes des comptes à payer : un par catégorie de dépense de l'Immobilier,
// plus les réparations. compte : clé de COMPTES (actif) au lieu d'un compte
// de dépense.
const POSTES = [
  { code: "TAXES_MUNICIPALES", numero: "5600", nom: "Immeubles — taxes municipales" },
  { code: "TAXES_SCOLAIRES", numero: "5610", nom: "Immeubles — taxe scolaire" },
  { code: "ASSURANCE", numero: "5620", nom: "Immeubles — assurances" },
  { code: "INTERETS", numero: "5630", nom: "Immeubles — intérêts hypothécaires" },
  { code: "ELECTRICITE", numero: "5640", nom: "Immeubles — électricité" },
  { code: "CHAUFFAGE", numero: "5650", nom: "Immeubles — chauffage" },
  { code: "ENTRETIEN", numero: "5660", nom: "Immeubles — entretien courant" },
  { code: "DENEIGEMENT", numero: "5670", nom: "Immeubles — déneigement, paysagement" },
  { code: "GESTION", numero: "5680", nom: "Immeubles — gestion, publicité, frais bancaires" },
  { code: "HONORAIRES", numero: "5690", nom: "Immeubles — honoraires professionnels" },
  { code: "AUTRE", numero: "5700", nom: "Immeubles — autres dépenses" },
  { code: "REPARATIONS", numero: "5710", nom: "Immeubles — réparations" },
  { code: "IMMOBILISATION", compte: "ameliorations", nom: "Immeubles — travaux majeurs (immobilisation)" },
];
const codePoste = (code) => `IMMO_${code}`;

const json = (texte, defaut) => {
  try { return texte ? JSON.parse(texte) : defaut; } catch { return defaut; }
};
const arrondi = (x) => Math.round((Number(x) || 0) * 100) / 100;
const jour = (d) => new Date(d).toISOString().slice(0, 10);
const premierDuMois = () => `${jour(new Date()).slice(0, 7)}-01`;

async function ecrire(cle, valeur) {
  await prisma.parametre.upsert({ where: { cle }, update: { valeur }, create: { cle, valeur } });
}

// ---------- Réglages ----------

// { actif, depuis: "2026-12-01", tresorerieId, comptes: { aRecevoir: "1150", … }, postes: { CODE: categorieDepenseId } }
// actif : l'option activée dans Administrateur → Modules
export async function lireLienCompta() {
  const [r, option] = await Promise.all([lireParametre(CLE).then((t) => json(t, {})), lireParametre(CLE_OPTION)]);
  return {
    actif: option === "actif",
    depuis: /^\d{4}-\d{2}-\d{2}$/.test(r.depuis || "") ? r.depuis : premierDuMois(),
    tresorerieId: r.tresorerieId || null,
    comptes: r.comptes || null,
    postes: r.postes || null,
  };
}

// Le lien joue seulement si l'option, le module Immobilier et le module
// Comptabilité sont tous actifs
export async function lienComptaActif(reglages) {
  const r = reglages || (await lireLienCompta());
  if (!r.actif) return false;
  return (await lireParametre("module_immobilier")) === "actif" && (await moduleComptabiliteActif());
}

// Réglages du client — entree : { depuis, tresorerieId } (chacun facultatif).
// L'activation, elle, se fait dans Administrateur → Modules.
export async function enregistrerLienCompta(entree) {
  const { actif, ...r } = await lireLienCompta();
  if (!actif) return { erreur: "Le lien avec la comptabilité n'est pas inclus dans cette installation." };
  if (entree.depuis !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entree.depuis || "") || Number.isNaN(new Date(entree.depuis).getTime())) return { erreur: "Date de départ invalide." };
    r.depuis = entree.depuis;
  }
  if (entree.tresorerieId !== undefined) {
    if (entree.tresorerieId && !(await prisma.compteTresorerie.findUnique({ where: { id: entree.tresorerieId } }))) return { erreur: "Compte introuvable." };
    r.tresorerieId = entree.tresorerieId || null;
  }
  await ecrire(CLE, JSON.stringify(r));
  return { reglages: r };
}

export async function dernierResultatCompta() {
  return json(await lireParametre(CLE_DERNIER), null);
}

// ---------- Comptes et postes ----------

// Compte du numéro souhaité s'il est libre (ou déjà le nôtre), sinon le
// prochain numéro libre du même type → numéro retenu
async function compteImmo({ numero, nom, type }) {
  const existant = await prisma.compte.findUnique({ where: { numero } });
  if (existant && existant.nom === nom && existant.type === type) return numero;
  if (!existant) {
    try {
      await prisma.compte.create({ data: { numero, nom, type } });
      return numero;
    } catch (e) {
      if (e.code !== "P2002") throw e;
    }
  }
  const deja = await prisma.compte.findFirst({ where: { nom, type } });
  if (deja) return deja.numero;
  return creerCompteAvecProchainNumero(type, nom, Number(numero));
}

// Crée au besoin les comptes et les postes de la location (une seule fois :
// les numéros retenus sont gardés dans le réglage) → { comptes, postes }
export async function assurerComptesImmo(reglages) {
  const r = reglages || (await lireLienCompta());
  await assurerPlanComptable();
  const comptes = { ...(r.comptes || {}) };
  const postes = { ...(r.postes || {}) };
  let change = false;
  for (const [cle, c] of Object.entries(COMPTES)) {
    if (comptes[cle] && (await prisma.compte.findUnique({ where: { numero: comptes[cle] } }))) continue;
    comptes[cle] = await compteImmo(c);
    change = true;
  }
  for (const p of POSTES) {
    if (postes[p.code] && (await prisma.categorieDepense.findUnique({ where: { id: postes[p.code] } }))) continue;
    const numero = p.compte ? comptes[p.compte] : await compteImmo({ numero: p.numero, nom: p.nom, type: "DEPENSE" });
    const poste = await prisma.categorieDepense.upsert({
      where: { code: codePoste(p.code) },
      update: {},
      create: { code: codePoste(p.code), nom: p.nom, compteDepenseNumero: numero },
    });
    postes[p.code] = poste.id;
    change = true;
  }
  if (change) {
    const { actif, ...actuels } = await lireLienCompta();
    await ecrire(CLE, JSON.stringify({ ...actuels, comptes, postes }));
  }
  return { comptes, postes };
}

// ---------- Fournisseurs ----------

// Fournisseur nommé (même nom, sans tenir compte des majuscules), créé s'il
// n'existe pas encore ; sans nom : « Divers — immeubles »
async function fournisseurNomme(nom) {
  const n = String(nom || "").trim().slice(0, 160) || FOURNISSEUR_DIVERS;
  const existant = await prisma.fournisseur.findFirst({ where: { nom: { equals: n, mode: "insensitive" } }, orderBy: { creeLe: "asc" } });
  if (existant) return existant.id;
  const f = await creerAvecNumero(prochainNumeroFournisseur, (numero) => prisma.fournisseur.create({ data: { nom: n, numero } }));
  return f.id;
}

// ---------- Période comptable ----------

// Les dates (jour comptable d'un élément de l'Immobilier) tombent-elles dans
// une période qui ne peut plus changer ? → message, ou null. anciennes :
// pièce existante modifiée ou retirée ; nouvelles : pièce ajoutée.
export async function periodeImmoBloquee({ anciennes = [], nouvelles = [] }) {
  const r = await lireLienCompta();
  if (!(await lienComptaActif(r))) return null;
  const depuis = new Date(`${r.depuis}T00:00:00Z`);
  try {
    for (const d of anciennes) if (d && new Date(d) >= depuis) await verifierPeriodeModifiable(new Date(d), { nouvellePiece: false });
    for (const d of nouvelles) if (d && new Date(d) >= depuis) await verifierPeriodeModifiable(new Date(d), { nouvellePiece: true });
  } catch (e) {
    if (String(e.message).startsWith("PERIODE_LOCK:")) return `${e.message.replace("PERIODE_LOCK:", "").split("\n").join(" — ")} (Immobilier relié à la comptabilité)`;
    throw e;
  }
  return null;
}

// ---------- Synchronisation ----------

const signature = (date, lignes) =>
  `${jour(date)}@${lignes.map((l) => `${l.numero}|${arrondi(l.debit).toFixed(2)}|${arrondi(l.credit).toFixed(2)}`).sort().join(";")}`;

const conciliee = (e) => e.lignes.some((l) => l.rapproche || l.rapprochementId || l.transactionBancaireId);

// Écritures d'une source (IMMO_CHARGE, IMMO_PAIEMENT) alignées sur les
// éléments voulus : [{ id, date, description, lignes: [{ compteNumero, debit, credit }] }]
async function alignerEcritures(source, voulus, journal, creePar) {
  const existantes = await prisma.ecritureComptable.findMany({
    where: { source },
    include: { lignes: { include: { compte: { select: { numero: true } } } } },
  });
  const parSource = new Map();
  for (const e of existantes) parSource.set(e.sourceId, [...(parSource.get(e.sourceId) || []), e]);
  const retirer = async (e) => {
    if (conciliee(e)) throw new Error(`l'écriture ${e.numero} est déjà conciliée — corrige-la à la main dans la comptabilité`);
    await verifierPeriodeModifiable(e.date, { nouvellePiece: false });
    await prisma.ecritureComptable.delete({ where: { id: e.id } });
  };
  let faites = 0;
  for (const v of voulus) {
    const deja = parSource.get(v.id) || [];
    parSource.delete(v.id);
    const voulue = signature(v.date, v.lignes.map((l) => ({ numero: l.compteNumero, debit: l.debit || 0, credit: l.credit || 0 })));
    if (deja.length === 1 && signature(deja[0].date, deja[0].lignes.map((l) => ({ numero: l.compte.numero, debit: l.debit, credit: l.credit }))) === voulue) continue;
    try {
      for (const e of deja) await retirer(e);
      await enregistrerEcriture({ date: v.date, description: v.description, source, sourceId: v.id, lignes: v.lignes, creePar });
      faites++;
    } catch (e) {
      journal.erreurs.push(`${v.description} : ${String(e.message).replace("PERIODE_LOCK:", "").split("\n")[0]}`);
    }
  }
  // Éléments disparus (ou avant la date de départ) : écriture retirée
  for (const liste of parSource.values()) {
    for (const e of liste) {
      try {
        await retirer(e);
        faites++;
      } catch (err) {
        journal.erreurs.push(`${e.description} (retirée de l'Immobilier) : ${String(err.message).replace("PERIODE_LOCK:", "").split("\n")[0]}`);
      }
    }
  }
  return faites;
}

const lignesPourEcriture = (f) => f.lignes.map((l) => ({ compteDepenseNumero: l.categorieDepense.compteDepenseNumero, montant: l.montant, description: l.description }));
const inclureFacture = { lignes: { include: { categorieDepense: true } }, compteTresorerie: { include: { compte: true } } };

async function ecrituresConciliees(depenseId) {
  const e = await prisma.ecritureComptable.findMany({ where: { source: { in: ["DEPENSE_RECUE", "DEPENSE_PAYEE"] }, sourceId: depenseId }, include: { lignes: true } });
  return e.some(conciliee);
}

// Factures des comptes à payer alignées sur les éléments voulus :
// [{ id, date, montant, description, fournisseurId, posteId, payer: { compteNumero, compteTresorerieId, mode } | null }]
async function alignerFactures(origine, voulus, journal, creePar) {
  const factures = await prisma.depense.findMany({ where: { origine }, include: inclureFacture });
  const parOrigine = new Map(factures.map((f) => [f.origineId, f]));
  let faites = 0;
  for (const v of voulus) {
    const f = parOrigine.get(v.id);
    parOrigine.delete(v.id);
    try {
      if (!f) {
        await verifierPeriodeModifiable(v.date, { nouvellePiece: true });
        const creee = await prisma.depense.create({
          data: {
            fournisseurId: v.fournisseurId, description: v.description, montant: v.montant, dateFacture: v.date, origine, origineId: v.id,
            lignes: { create: [{ categorieDepenseId: v.posteId, montant: v.montant }] },
          },
          include: inclureFacture,
        });
        await posterDepenseRecue({ ...creee, lignesPourEcriture: lignesPourEcriture(creee) }, creePar);
        if (v.payer) {
          const payee = await prisma.depense.update({
            where: { id: creee.id },
            data: { statut: "PAYEE", datePaiement: v.date, compteTresorerieId: v.payer.compteTresorerieId, modePaiement: v.payer.mode || null },
          });
          await posterDepensePayee(payee, creePar, v.payer.compteNumero, v.payer.mode || null);
        }
        faites++;
        continue;
      }
      const ligne = f.lignes.length === 1 ? f.lignes[0] : null;
      const pareil = ligne && ligne.categorieDepenseId === v.posteId && arrondi(ligne.montant) === arrondi(v.montant) && arrondi(f.montant) === arrondi(v.montant)
        && jour(f.dateFacture) === jour(v.date) && f.fournisseurId === v.fournisseurId && f.description === v.description && f.tpsPayee === 0 && f.tvqPayee === 0;
      if (pareil) continue;
      if (await ecrituresConciliees(f.id)) throw new Error("la facture est déjà conciliée — corrige-la à la main dans la comptabilité");
      await verifierPeriodeModifiable(f.dateFacture, { nouvellePiece: false });
      await verifierPeriodeModifiable(v.date, { nouvellePiece: true });
      const maj = await prisma.$transaction(async (tx) => {
        await tx.ligneDepense.deleteMany({ where: { depenseId: f.id } });
        return tx.depense.update({
          where: { id: f.id },
          data: {
            fournisseurId: v.fournisseurId, description: v.description, montant: v.montant, tpsPayee: 0, tvqPayee: 0, dateFacture: v.date,
            lignes: { create: [{ categorieDepenseId: v.posteId, montant: v.montant }] },
          },
          include: inclureFacture,
        });
      });
      await prisma.ecritureComptable.deleteMany({ where: { source: "DEPENSE_RECUE", sourceId: f.id } });
      await posterDepenseRecue({ ...maj, lignesPourEcriture: lignesPourEcriture(maj) }, creePar);
      if (f.statut === "PAYEE" && arrondi(f.montant) !== arrondi(v.montant)) {
        await prisma.ecritureComptable.deleteMany({ where: { source: "DEPENSE_PAYEE", sourceId: f.id } });
        await posterDepensePayee(maj, creePar, f.compteTresorerie?.compte?.numero || "1000", f.modePaiement);
      }
      faites++;
    } catch (e) {
      journal.erreurs.push(`${v.description} : ${String(e.message).replace("PERIODE_LOCK:", "").split("\n")[0]}`);
    }
  }
  // Éléments disparus : facture impayée retirée, facture payée détachée
  for (const f of parOrigine.values()) {
    try {
      if (f.statut === "PAYEE") {
        await prisma.depense.update({ where: { id: f.id }, data: { origine: null, origineId: null } });
        journal.lignes.push(`« ${f.description} » était déjà payée : elle reste aux comptes à payer`);
      } else {
        if (await ecrituresConciliees(f.id)) throw new Error("la facture est déjà conciliée");
        await verifierPeriodeModifiable(f.dateFacture, { nouvellePiece: false });
        await prisma.ecritureComptable.deleteMany({ where: { source: { in: ["DEPENSE_RECUE", "DEPENSE_PAYEE"] }, sourceId: f.id } });
        await prisma.depense.delete({ where: { id: f.id } });
      }
      faites++;
    } catch (e) {
      journal.erreurs.push(`${f.description} (retirée de l'Immobilier) : ${String(e.message).replace("PERIODE_LOCK:", "").split("\n")[0]}`);
    }
  }
  return faites;
}

const LIEU = { select: { numero: true, type: true, immeuble: { select: { nom: true } } } };
const lieuDe = (logement) => (logement ? `${logement.immeuble.nom}, ${nomLogement(logement)}` : "");
const court = (t, n = 190) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

async function compteEncaissement(tresorerieId) {
  const t = tresorerieId ? await prisma.compteTresorerie.findUnique({ where: { id: tresorerieId }, include: { compte: true } }) : null;
  if (t) return { compteNumero: t.compte.numero, compteTresorerieId: t.id };
  const banque = await prisma.compteTresorerie.findFirst({ where: { compte: { numero: "1000" } } });
  return { compteNumero: "1000", compteTresorerieId: banque?.id || null };
}

async function synchroniser({ creePar = "Immobilier", payer = {} } = {}) {
  const r = await lireLienCompta();
  if (!(await lienComptaActif(r))) return null;
  const { comptes, postes } = await assurerComptesImmo(r);
  const depuis = new Date(`${r.depuis}T00:00:00Z`);
  const encaissement = await compteEncaissement(r.tresorerieId);
  const journal = { lignes: [], erreurs: [] };

  // 1. Loyers et frais
  const charges = await prisma.chargeImmo.findMany({ where: { date: { gte: depuis } }, include: { bail: { select: { logement: LIEU } } }, orderBy: { date: "asc" } });
  const voulusCharges = charges.filter((c) => arrondi(c.montant) !== 0).map((c) => {
    const m = arrondi(c.montant);
    const revenu = c.type === "LOYER" ? comptes.revenus : comptes.autresRevenus;
    const description = court(`${c.description || libelle(TYPES_CHARGE, c.type)} — ${lieuDe(c.bail.logement)}`);
    const lignes = m > 0
      ? [{ compteNumero: comptes.aRecevoir, debit: m, description }, { compteNumero: revenu, credit: m, description }]
      : [{ compteNumero: revenu, debit: -m, description }, { compteNumero: comptes.aRecevoir, credit: -m, description }];
    return { id: c.id, date: c.date, description, lignes };
  });
  const nCharges = await alignerEcritures(SOURCE_CHARGE, voulusCharges, journal, creePar);

  // 2. Paiements des locataires
  const paiements = await prisma.paiementImmo.findMany({ where: { date: { gte: depuis } }, include: { bail: { select: { logement: LIEU } } }, orderBy: { date: "asc" } });
  const voulusPaiements = paiements.filter((p) => arrondi(p.montant) > 0).map((p) => {
    const m = arrondi(p.montant);
    const description = court(`Paiement de loyer${p.reference ? ` (réf. ${p.reference})` : ""} — ${lieuDe(p.bail.logement)}`);
    return { id: p.id, date: p.date, description, lignes: [{ compteNumero: encaissement.compteNumero, debit: m, description }, { compteNumero: comptes.aRecevoir, credit: m, description }] };
  });
  const nPaiements = await alignerEcritures(SOURCE_PAIEMENT, voulusPaiements, journal, creePar);

  // 3. Dépenses des immeubles → comptes à payer
  const depenses = await prisma.depenseImmo.findMany({ where: { date: { gte: depuis } }, include: { immeuble: { select: { nom: true } } } });
  const voulusDepenses = [];
  for (const d of depenses.filter((x) => arrondi(x.montant) > 0)) {
    let fournisseurId = d.fournisseurId;
    if (!fournisseurId) {
      fournisseurId = await fournisseurNomme(d.payeA);
      await prisma.depenseImmo.update({ where: { id: d.id }, data: { fournisseurId } });
    }
    const quoi = d.description || libelle(CATEGORIES_DEPENSE, d.categorie);
    voulusDepenses.push({
      id: d.id, date: d.date, montant: arrondi(d.montant), fournisseurId,
      description: court(`${d.immeuble.nom} — ${quoi}${d.reference ? ` (réf. ${d.reference})` : ""}`),
      posteId: postes[d.categorie] || postes.AUTRE,
      payer: payer[d.id] ? { ...encaissement, mode: payer[d.id].mode } : null,
    });
  }
  const nDepenses = await alignerFactures(ORIGINE_DEPENSE, voulusDepenses, journal, creePar);

  // 4. Réparations terminées avec un coût réel → comptes à payer
  const reparations = await prisma.reparationImmo.findMany({
    where: { statut: "TERMINEE", coutReel: { gt: 0 }, OR: [{ dateFin: { gte: depuis } }, { dateFin: null, creeLe: { gte: depuis } }] },
    include: { immeuble: { select: { nom: true } } },
  });
  const voulusReparations = [];
  for (const rep of reparations) {
    let fournisseurId = rep.fournisseurId;
    if (!fournisseurId) {
      fournisseurId = await fournisseurNomme(rep.entrepreneur);
      await prisma.reparationImmo.update({ where: { id: rep.id }, data: { fournisseurId } });
    }
    voulusReparations.push({
      id: rep.id, date: rep.dateFin || rep.creeLe, montant: arrondi(rep.coutReel), fournisseurId,
      description: court(`${rep.immeuble.nom} — ${rep.numero} ${rep.titre}${rep.numeroFacture ? ` (facture ${rep.numeroFacture})` : ""}`),
      posteId: rep.immobilisation ? postes.IMMOBILISATION : postes.REPARATIONS,
      payer: null,
    });
  }
  const nReparations = await alignerFactures(ORIGINE_REPARATION, voulusReparations, journal, creePar);

  const total = nCharges + nPaiements + nDepenses + nReparations;
  if (total > 0) journal.lignes.unshift(`${total} mise${total > 1 ? "s" : ""} à jour aux livres (loyers ${nCharges}, paiements ${nPaiements}, dépenses ${nDepenses}, réparations ${nReparations})`);
  const resultat = { le: new Date().toISOString(), lignes: journal.lignes, erreurs: journal.erreurs };
  if (total > 0 || journal.erreurs.length > 0 || journal.lignes.length > 0) await ecrire(CLE_DERNIER, JSON.stringify(resultat));
  return resultat;
}

// Une synchronisation à la fois (deux modifications presque en même temps
// ne doivent pas inscrire deux fois la même écriture)
let file = Promise.resolve();

// → null si le lien est inactif, sinon { le, lignes, erreurs }. Ne lance
// jamais d'erreur : l'Immobilier est déjà enregistré, l'écart est signalé.
export function synchroniserComptaImmo(options) {
  const suite = file.then(() => synchroniser(options)).catch((e) => {
    console.error("Immobilier → comptabilité :", e);
    return { le: new Date().toISOString(), lignes: [], erreurs: [`Synchronisation interrompue : ${e.message}`] };
  });
  file = suite;
  return suite;
}

// Résumé pour Immobilier → Comptabilité : écritures et factures reliées
export async function etatLienCompta() {
  const [charges, paiements, factures] = await Promise.all([
    prisma.ecritureComptable.count({ where: { source: SOURCE_CHARGE } }),
    prisma.ecritureComptable.count({ where: { source: SOURCE_PAIEMENT } }),
    prisma.depense.groupBy({ by: ["statut"], where: { origine: { in: [ORIGINE_DEPENSE, ORIGINE_REPARATION] } }, _count: true, _sum: { montant: true } }),
  ]);
  const de = (s) => factures.find((f) => f.statut === s);
  return {
    charges, paiements,
    aPayer: { nombre: de("IMPAYEE")?._count || 0, montant: de("IMPAYEE")?._sum.montant || 0 },
    payees: { nombre: de("PAYEE")?._count || 0, montant: de("PAYEE")?._sum.montant || 0 },
  };
}

// Statut aux comptes à payer des éléments reliés : { [origineId]: "IMPAYEE" | "PAYEE" }
export async function statutsFactures(origine, ids) {
  if (!ids.length) return {};
  const f = await prisma.depense.findMany({ where: { origine, origineId: { in: ids } }, select: { origineId: true, statut: true } });
  return Object.fromEntries(f.map((x) => [x.origineId, x.statut]));
}
