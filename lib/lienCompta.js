// Moteur commun des modules reliés à la comptabilité (Immobilier,
// Copropriété) : lib/immobilierCompta.js et lib/coproprieteCompta.js le
// configurent — comptes et postes propres au module, et ce qui doit aller
// aux livres.
//
// Le lien est une option du forfait, activée seulement par le développeur ou
// le super-administrateur (Administrateur → Modules, sous le module :
// Parametre « <module>_comptabilite »). Le client règle ensuite la date de
// départ et le compte de banque des encaissements (Parametre JSON propre au
// module). Le lien joue seulement si l'option, le module et le module
// Comptabilité sont tous actifs.
//
// Le module reste la source : synchroniser() compare ce qu'il contient à ce
// qui est aux livres et corrige l'écart — écriture (source + sourceId) ou
// facture aux comptes à payer (Depense.origine + origineId) créée, refaite si
// le montant, la date, les comptes ou le fournisseur ont changé, retirée si
// l'élément a disparu ou est daté d'avant la date de départ. Rien n'est
// touché dans une période verrouillée ou fermée, ni une écriture déjà
// conciliée : l'écart est signalé. Une facture déjà payée dont l'élément
// disparaît reste aux comptes à payer (détachée). Une synchronisation à la
// fois par module.
//
// Comptes et postes créés à la première synchronisation seulement (jamais
// dans une installation qui ne s'en sert pas) ; les numéros retenus sont
// gardés dans le réglage du module.

import { prisma } from "./prisma";
import { lireParametre } from "./parametres";
import { prochainNumeroFournisseur, creerAvecNumero } from "./numerotation";
import {
  moduleComptabiliteActif, assurerPlanComptable, enregistrerEcriture, posterDepenseRecue, posterDepensePayee,
  verifierPeriodeModifiable, creerCompteAvecProchainNumero,
} from "./comptabilite";

export const arrondi = (x) => Math.round((Number(x) || 0) * 100) / 100;
export const court = (t, n = 190) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const json = (texte, defaut) => {
  try { return texte ? JSON.parse(texte) : defaut; } catch { return defaut; }
};
const jour = (d) => new Date(d).toISOString().slice(0, 10);
const premierDuMois = () => `${jour(new Date()).slice(0, 7)}-01`;
const messageDe = (e) => String(e.message).replace("PERIODE_LOCK:", "").split("\n")[0];

async function ecrire(cle, valeur) {
  await prisma.parametre.upsert({ where: { cle }, update: { valeur }, create: { cle, valeur } });
}

// Compte du numéro souhaité s'il est libre (ou déjà le nôtre), sinon le
// prochain numéro libre du même type → numéro retenu
async function compteNomme({ numero, nom, type }) {
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

// Fournisseur nommé (même nom, sans tenir compte des majuscules), créé s'il
// n'existe pas encore ; sans nom : le fournisseur « divers » du module
async function fournisseurNomme(nom, divers) {
  const n = String(nom || "").trim().slice(0, 160) || divers;
  const existant = await prisma.fournisseur.findFirst({ where: { nom: { equals: n, mode: "insensitive" } }, orderBy: { creeLe: "asc" } });
  if (existant) return existant.id;
  const f = await creerAvecNumero(prochainNumeroFournisseur, (numero) => prisma.fournisseur.create({ data: { nom: n, numero } }));
  return f.id;
}

async function compteEncaissement(tresorerieId) {
  const t = tresorerieId ? await prisma.compteTresorerie.findUnique({ where: { id: tresorerieId }, include: { compte: true } }) : null;
  if (t) return { compteNumero: t.compte.numero, compteTresorerieId: t.id };
  const banque = await prisma.compteTresorerie.findFirst({ where: { compte: { numero: "1000" } } });
  return { compteNumero: "1000", compteTresorerieId: banque?.id || null };
}

const signature = (date, lignes) =>
  `${jour(date)}@${lignes.map((l) => `${l.numero}|${arrondi(l.debit).toFixed(2)}|${arrondi(l.credit).toFixed(2)}`).sort().join(";")}`;

const conciliee = (e) => e.lignes.some((l) => l.rapproche || l.rapprochementId || l.transactionBancaireId);

// Écritures d'une source alignées sur les éléments voulus :
// [{ id, date, description, lignes: [{ compteNumero, debit, credit, description }] }]
async function alignerEcritures(source, voulus, journal, creePar, retireDe) {
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
      journal.erreurs.push(`${v.description} : ${messageDe(e)}`);
    }
  }
  // Éléments disparus (ou avant la date de départ) : écriture retirée
  for (const liste of parSource.values()) {
    for (const e of liste) {
      try {
        await retirer(e);
        faites++;
      } catch (err) {
        journal.erreurs.push(`${e.description} (${retireDe}) : ${messageDe(err)}`);
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

// Factures des comptes à payer alignées sur les éléments voulus. Taxes
// laissées dans le montant (aucun CTI ni RTI : loyer résidentiel et
// syndicat de copropriété ne les récupèrent pas).
// [{ id, date, montant, description, fournisseurId, posteId, payer: { compteNumero, compteTresorerieId, mode } | null }]
async function alignerFactures(origine, voulus, journal, creePar, retireDe) {
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
      journal.erreurs.push(`${v.description} : ${messageDe(e)}`);
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
      journal.erreurs.push(`${f.description} (${retireDe}) : ${messageDe(e)}`);
    }
  }
  return faites;
}

// Fabrique du lien d'un module. config :
//   nom            « Immobilier » (messages)
//   retireDe       « retirée de l'Immobilier » (messages)
//   cleModule      « module_immobilier »
//   cleOption      « module_immobilier_comptabilite » (Administrateur → Modules)
//   cle            réglages du client (JSON) ; cleDernier : dernier résultat (JSON)
//   comptes        { cle: { numero, nom, type } } ; postes : [{ code, numero, nom } | { code, compte, nom }]
//   prefixePoste   « IMMO_ » (code des postes des comptes à payer)
//   fournisseurDivers  fournisseur des factures sans fournisseur ni nom
//   groupes        [{ genre: "ecritures", source, libelle } | { genre: "factures", origine, libelle }]
//   preparer(ctx)  → { [source ou origine]: éléments voulus } ; ctx : { depuis,
//                  comptes, postes, encaissement, payer, fournisseurNomme }
export function creerLienCompta(config) {
  const { cle, cleDernier, cleOption, cleModule, comptes: COMPTES, postes: POSTES, prefixePoste, groupes } = config;
  const sources = groupes.filter((g) => g.genre === "ecritures");
  const origines = groupes.filter((g) => g.genre === "factures").map((g) => g.origine);

  // { actif, depuis: "2026-12-01", tresorerieId, comptes: { cle: numéro }, postes: { CODE: categorieDepenseId } }
  async function lire() {
    const [r, option] = await Promise.all([lireParametre(cle).then((t) => json(t, {})), lireParametre(cleOption)]);
    return {
      actif: option === "actif",
      depuis: /^\d{4}-\d{2}-\d{2}$/.test(r.depuis || "") ? r.depuis : premierDuMois(),
      tresorerieId: r.tresorerieId || null,
      comptes: r.comptes || null,
      postes: r.postes || null,
    };
  }

  async function actif(reglages) {
    const r = reglages || (await lire());
    if (!r.actif) return false;
    return (await lireParametre(cleModule)) === "actif" && (await moduleComptabiliteActif());
  }

  // Réglages du client — entree : { depuis, tresorerieId } (chacun facultatif)
  async function enregistrer(entree) {
    const { actif: inclus, ...r } = await lire();
    if (!inclus) return { erreur: "Le lien avec la comptabilité n'est pas inclus dans cette installation." };
    if (entree.depuis !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entree.depuis || "") || Number.isNaN(new Date(entree.depuis).getTime())) return { erreur: "Date de départ invalide." };
      r.depuis = entree.depuis;
    }
    if (entree.tresorerieId !== undefined) {
      if (entree.tresorerieId && !(await prisma.compteTresorerie.findUnique({ where: { id: entree.tresorerieId } }))) return { erreur: "Compte introuvable." };
      r.tresorerieId = entree.tresorerieId || null;
    }
    await ecrire(cle, JSON.stringify(r));
    return { reglages: r };
  }

  const dernier = async () => json(await lireParametre(cleDernier), null);

  // Comptes et postes du module, créés au besoin → { comptes, postes }
  async function assurerComptes(reglages) {
    const r = reglages || (await lire());
    await assurerPlanComptable();
    const comptes = { ...(r.comptes || {}) };
    const postes = { ...(r.postes || {}) };
    let change = false;
    for (const [c, def] of Object.entries(COMPTES)) {
      if (comptes[c] && (await prisma.compte.findUnique({ where: { numero: comptes[c] } }))) continue;
      comptes[c] = await compteNomme(def);
      change = true;
    }
    for (const p of POSTES) {
      if (postes[p.code] && (await prisma.categorieDepense.findUnique({ where: { id: postes[p.code] } }))) continue;
      const numero = p.compte ? comptes[p.compte] : await compteNomme({ numero: p.numero, nom: p.nom, type: "DEPENSE" });
      const code = `${prefixePoste}${p.code}`;
      const poste = await prisma.categorieDepense.upsert({ where: { code }, update: {}, create: { code, nom: p.nom, compteDepenseNumero: numero } });
      postes[p.code] = poste.id;
      change = true;
    }
    if (change) {
      const { actif: _, ...actuels } = await lire();
      await ecrire(cle, JSON.stringify({ ...actuels, comptes, postes }));
    }
    return { comptes, postes };
  }

  // Les dates tombent-elles dans une période qui ne peut plus changer ?
  // → message, ou null. anciennes : pièce modifiée ou retirée ; nouvelles : pièce ajoutée.
  async function periodeBloquee({ anciennes = [], nouvelles = [] }) {
    const r = await lire();
    if (!(await actif(r))) return null;
    const depuis = new Date(`${r.depuis}T00:00:00Z`);
    try {
      for (const d of anciennes) if (d && new Date(d) >= depuis) await verifierPeriodeModifiable(new Date(d), { nouvellePiece: false });
      for (const d of nouvelles) if (d && new Date(d) >= depuis) await verifierPeriodeModifiable(new Date(d), { nouvellePiece: true });
    } catch (e) {
      if (String(e.message).startsWith("PERIODE_LOCK:")) return `${e.message.replace("PERIODE_LOCK:", "").split("\n").join(" — ")} (${config.nom} relié à la comptabilité)`;
      throw e;
    }
    return null;
  }

  async function faire({ creePar = config.nom, payer = {} } = {}) {
    const r = await lire();
    if (!(await actif(r))) return null;
    const { comptes, postes } = await assurerComptes(r);
    const depuis = new Date(`${r.depuis}T00:00:00Z`);
    const encaissement = await compteEncaissement(r.tresorerieId);
    const journal = { lignes: [], erreurs: [] };
    const voulus = await config.preparer({ depuis, comptes, postes, encaissement, payer, fournisseurNomme: (nom) => fournisseurNomme(nom, config.fournisseurDivers) });
    const faits = [];
    for (const g of groupes) {
      const n = g.genre === "ecritures"
        ? await alignerEcritures(g.source, voulus[g.source] || [], journal, creePar, config.retireDe)
        : await alignerFactures(g.origine, voulus[g.origine] || [], journal, creePar, config.retireDe);
      faits.push([g.libelle, n]);
    }
    const total = faits.reduce((s, [, n]) => s + n, 0);
    if (total > 0) journal.lignes.unshift(`${total} mise${total > 1 ? "s" : ""} à jour aux livres (${faits.map(([l, n]) => `${l} ${n}`).join(", ")})`);
    const resultat = { le: new Date().toISOString(), lignes: journal.lignes, erreurs: journal.erreurs };
    if (total > 0 || journal.erreurs.length > 0 || journal.lignes.length > 0) await ecrire(cleDernier, JSON.stringify(resultat));
    return resultat;
  }

  // Une synchronisation à la fois → null si le lien est inactif, sinon
  // { le, lignes, erreurs }. Ne lance jamais d'erreur : le module est déjà
  // enregistré, l'écart est signalé.
  let file = Promise.resolve();
  function synchroniser(options) {
    const suite = file.then(() => faire(options)).catch((e) => {
      console.error(`${config.nom} → comptabilité :`, e);
      return { le: new Date().toISOString(), lignes: [], erreurs: [`Synchronisation interrompue : ${e.message}`] };
    });
    file = suite;
    return suite;
  }

  // Résumé pour l'écran du lien : écritures par groupe et factures reliées
  async function etat() {
    const [ecritures, factures] = await Promise.all([
      Promise.all(sources.map(async (g) => ({ libelle: g.libelleEtat || g.libelle, nombre: await prisma.ecritureComptable.count({ where: { source: g.source } }) }))),
      origines.length ? prisma.depense.groupBy({ by: ["statut"], where: { origine: { in: origines } }, _count: true, _sum: { montant: true } }) : [],
    ]);
    const de = (s) => factures.find((f) => f.statut === s);
    return {
      ecritures,
      aPayer: { nombre: de("IMPAYEE")?._count || 0, montant: de("IMPAYEE")?._sum.montant || 0 },
      payees: { nombre: de("PAYEE")?._count || 0, montant: de("PAYEE")?._sum.montant || 0 },
    };
  }

  return { CLE_OPTION: cleOption, lire, actif, enregistrer, dernier, assurerComptes, periodeBloquee, synchroniser, etat };
}

// Statut aux comptes à payer des éléments reliés : { [origineId]: "IMPAYEE" | "PAYEE" }
export async function statutsFactures(origine, ids) {
  if (!ids.length) return {};
  const f = await prisma.depense.findMany({ where: { origine, origineId: { in: ids } }, select: { origineId: true, statut: true } });
  return Object.fromEntries(f.map((x) => [x.origineId, x.statut]));
}
