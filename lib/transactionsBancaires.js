// Transactions bancaires — l'équivalent des « flux bancaires » de QuickBooks.
//
// Les transactions du relevé (fichier téléchargé de la banque en ligne, lu
// par lib/releveBancaire.js) arrivent « à examiner ». Chacune est ensuite
// reliée aux livres d'une de ces façons :
// - associée à des lignes d'écriture qui existent déjà sur le compte
//   (facture payée, dépense payée, paie, remise…) — un dépôt peut regrouper
//   plusieurs lignes ;
// - paiement d'une dépense ou d'une facture encore impayée, marquée payée ;
// - ajoutée : dépense fournisseur, écriture vers un autre compte, ou
//   transfert entre deux comptes de trésorerie, créés depuis la transaction ;
// - exclue (doublon, transaction hors entreprise).
// Les lignes reliées (LigneEcriture.transactionBancaireId) sont cochées pour
// la conciliation bancaire, et le solde du relevé est mis à jour à l'import.
//
// Montants vus par le titulaire du compte (+ entre, − sort) : pour une ligne
// d'écriture sur le compte, c'est débit − crédit, que le compte soit un actif
// (banque) ou un passif (carte de crédit).
const crypto = require("crypto");
const { prisma } = require("./prisma");
const { lireReleve } = require("./releveBancaire");
const { sensCompte } = require("./rapprochement");
const { jourCivil, creerDepenseDansTransaction, comptabiliserDepenseRecue } = require("./depenses");
const { enregistrerEcriture, verifierPeriodeModifiable, posterDepensePayee, posterFacturePayee } = require("./comptabilite");
const { prochainNumeroFournisseur } = require("./numerotation");

const JOUR = 24 * 3600 * 1000;
const montantTitulaire = (ligne) => ligne.debit - ligne.credit;
const egal = (a, b) => Math.abs(a - b) < 0.005;
const arrondir = (n) => Math.round(n * 100) / 100;
const dateStr = (date) => new Date(date).toISOString().slice(0, 10); // dates ancrées à midi UTC

// Fenêtre où chercher l'écriture d'une transaction : un chèque peut être
// encaissé des semaines après sa saisie, et une dépense saisie quelques
// jours après être passée en banque.
const JOURS_AVANT = 60;
const JOURS_APRES = 15;

// ---------- IMPORT ----------

// Le rang distingue deux transactions identiques le même jour (deux cafés à
// 2,50 $) : réimporter une période qui chevauche la précédente donne les
// mêmes clés, donc aucun doublon.
function clesTransactions(transactions) {
  const vus = new Map();
  return transactions.map((t) => {
    const base = `${t.date}|${t.montant.toFixed(2)}|${t.description.toUpperCase().replace(/\s+/g, " ")}`;
    const rang = (vus.get(base) || 0) + 1;
    vus.set(base, rang);
    return crypto.createHash("sha1").update(`${base}|${rang}`).digest("hex");
  });
}

// Retourne { choixCompte } si le fichier contient plusieurs comptes et
// qu'aucun n'a été choisi (`numeroCompte`) — l'écran demande alors lequel.
async function importerReleve({ compteTresorerieId, octets, nomFichier, numeroCompte }) {
  const compte = await prisma.compteTresorerie.findUnique({ where: { id: compteTresorerieId } });
  if (!compte) throw new Error("Compte introuvable.");

  const { comptes } = lireReleve(octets, nomFichier);
  let releve = comptes[0];
  if (comptes.length > 1) {
    releve = comptes.find((c) => c.numero === numeroCompte);
    if (!releve) return { choixCompte: comptes.map((c) => ({ numero: c.numero, nombre: c.transactions.length })) };
  }

  const cles = clesTransactions(releve.transactions);
  const existantes = new Set((await prisma.transactionBancaire.findMany({
    where: { compteTresorerieId, cle: { in: cles } },
    select: { cle: true },
  })).map((t) => t.cle));

  const importId = crypto.randomUUID();
  const nouvelles = releve.transactions
    .map((t, i) => ({ ...t, cle: cles[i] }))
    .filter((t) => !existantes.has(t.cle));
  await prisma.transactionBancaire.createMany({
    data: nouvelles.map((t) => ({
      compteTresorerieId,
      date: jourCivil(t.date),
      montant: t.montant,
      description: t.description,
      reference: t.reference,
      cle: t.cle,
      importId,
      fichier: nomFichier || null,
    })),
    skipDuplicates: true,
  });

  // Solde du relevé (fichier OFX, ou colonne Solde d'un CSV) : remplace le
  // solde relevé à la main s'il est plus récent. Même sens que la
  // conciliation — une carte de crédit montre le solde dû en positif.
  let soldeMisAJour = null;
  if (releve.solde) {
    const dateSolde = jourCivil(releve.solde.date);
    if (!compte.soldeReleveLe || dateSolde >= compte.soldeReleveLe) {
      soldeMisAJour = { montant: sensCompte(compte.categorie) * releve.solde.montant, date: releve.solde.date };
      await prisma.compteTresorerie.update({
        where: { id: compteTresorerieId },
        data: { soldeReleve: soldeMisAJour.montant, soldeReleveLe: dateSolde },
      });
    }
  }

  const dates = releve.transactions.map((t) => t.date).sort();
  return {
    importId,
    importees: nouvelles.length,
    dejaImportees: releve.transactions.length - nouvelles.length,
    debut: dates[0],
    fin: dates[dates.length - 1],
    solde: soldeMisAJour,
  };
}

// Retire les transactions d'un import qui n'ont pas encore été examinées
// (mauvais compte choisi, mauvais fichier) — celles déjà reliées restent.
async function annulerImport(importId) {
  const { count } = await prisma.transactionBancaire.deleteMany({ where: { importId, statut: "A_EXAMINER" } });
  return count;
}

// Une écriture supprimée ailleurs (dépense corrigée ou supprimée, facture
// annulée…) emporte ses lignes : la transaction qui y était reliée retourne
// « à examiner » plutôt que de rester reliée à rien.
async function reparerStatuts(compteTresorerieId) {
  await prisma.transactionBancaire.updateMany({
    where: { compteTresorerieId, statut: { in: ["ASSOCIEE", "AJOUTEE"] }, lignes: { none: {} } },
    data: { statut: "A_EXAMINER", creeType: null, creeId: null, examineLe: null, examinePar: null },
  });
}

// ---------- SUGGESTIONS ----------

// Une suggestion par transaction à examiner : la ligne d'écriture du même
// montant la plus proche en date (le numéro de chèque l'emporte), sinon une
// dépense ou facture impayée du même montant. Chaque ligne ou pièce n'est
// proposée qu'une fois — les paires les plus proches sont servies d'abord,
// pour que des frais mensuels identiques tombent chacun sur leur mois.
async function calculerSuggestions(compteTresorerie, transactions) {
  if (transactions.length === 0) return {};
  const temps = transactions.map((t) => new Date(t.date).getTime());
  const debut = new Date(Math.min(...temps) - JOURS_AVANT * JOUR);
  const fin = new Date(Math.max(...temps) + JOURS_APRES * JOUR);
  const estCarte = compteTresorerie.categorie === "CARTE_CREDIT";

  const [lignes, depenses, factures] = await Promise.all([
    prisma.ligneEcriture.findMany({
      where: { compteId: compteTresorerie.compteId, transactionBancaireId: null, ecriture: { date: { gte: debut, lte: fin } } },
      include: { ecriture: { select: { numero: true, date: true, description: true } } },
    }),
    prisma.depense.findMany({ where: { statut: "IMPAYEE" }, include: { fournisseur: { select: { nom: true } } } }),
    estCarte ? [] : prisma.facture.findMany({
      where: { statut: "IMPAYEE" },
      select: { id: true, numero: true, totalAvecTaxes: true, dateEmission: true, bon: { select: { client: { select: { nom: true } } } } },
    }),
  ]);

  const paires = [];
  for (const t of transactions) {
    const tTemps = new Date(t.date).getTime();
    for (const l of lignes) {
      if (!egal(montantTitulaire(l), t.montant)) continue;
      const ecart = (new Date(l.ecriture.date).getTime() - tTemps) / JOUR;
      if (ecart < -JOURS_AVANT || ecart > JOURS_APRES) continue;
      const chequeTrouve = t.reference && `${l.ecriture.description} ${l.description || ""}`.includes(t.reference);
      paires.push({
        t, cle: `L${l.id}`, score: Math.abs(ecart) - (chequeTrouve ? 100 : 0),
        suggestion: { type: "LIGNE", ligneId: l.id, numero: l.ecriture.numero, date: dateStr(l.ecriture.date), description: l.description || l.ecriture.description },
      });
    }
    if (t.montant < 0) {
      for (const d of depenses) {
        const ecart = (new Date(d.dateFacture).getTime() - tTemps) / JOUR;
        if (!egal(d.montant, -t.montant) || ecart > 5 || ecart < -365) continue;
        paires.push({
          t, cle: `D${d.id}`, score: 1000 + Math.abs(ecart),
          suggestion: { type: "DEPENSE", depenseId: d.id, date: dateStr(d.dateFacture), description: `${d.fournisseur.nom} — ${d.description}` },
        });
      }
    } else {
      for (const f of factures) {
        const ecart = (new Date(f.dateEmission).getTime() - tTemps) / JOUR;
        if (!egal(f.totalAvecTaxes, t.montant) || ecart > 5 || ecart < -365) continue;
        paires.push({
          t, cle: `F${f.id}`, score: 1000 + Math.abs(ecart),
          suggestion: { type: "FACTURE", factureId: f.id, numero: f.numero, date: dateStr(f.dateEmission), description: f.bon?.client?.nom || "" },
        });
      }
    }
  }

  paires.sort((a, b) => a.score - b.score);
  const suggestions = {};
  const utilisees = new Set();
  for (const p of paires) {
    if (suggestions[p.t.id] || utilisees.has(p.cle)) continue;
    suggestions[p.t.id] = p.suggestion;
    utilisees.add(p.cle);
  }
  return suggestions;
}

// Lignes du compte encore libres, du même sens que la transaction, autour de
// sa date — pour « Trouver une correspondance » (plusieurs lignes possibles).
async function obtenirCandidats(transactionId) {
  const t = await prisma.transactionBancaire.findUnique({ where: { id: transactionId }, include: { compteTresorerie: true } });
  if (!t) throw new Error("Transaction introuvable.");
  const temps = new Date(t.date).getTime();
  const lignes = await prisma.ligneEcriture.findMany({
    where: {
      compteId: t.compteTresorerie.compteId,
      transactionBancaireId: null,
      ecriture: { date: { gte: new Date(temps - 90 * JOUR), lte: new Date(temps + 30 * JOUR) } },
    },
    include: { ecriture: { select: { numero: true, date: true, description: true } } },
    orderBy: { ecriture: { date: "desc" } },
    take: 300,
  });
  return lignes
    .filter((l) => montantTitulaire(l) * t.montant > 0)
    .map((l) => ({
      id: l.id,
      numero: l.ecriture.numero,
      date: dateStr(l.ecriture.date),
      description: l.description || l.ecriture.description,
      montant: arrondir(montantTitulaire(l)),
    }));
}

// ---------- EXAMEN ----------

async function chargerAExaminer(transactionId) {
  const t = await prisma.transactionBancaire.findUnique({
    where: { id: transactionId },
    include: { compteTresorerie: { include: { compte: true } } },
  });
  if (!t) throw new Error("Transaction introuvable.");
  if (t.statut !== "A_EXAMINER") throw new Error("Cette transaction a déjà été examinée.");
  return t;
}

const marquerExaminee = (statut, nomUtilisateur, cree = {}) => ({
  statut, creeType: cree.type || null, creeId: cree.id || null, examineLe: new Date(), examinePar: nomUtilisateur || null,
});

// Relie des lignes existantes à la transaction et les coche pour la
// conciliation (celles déjà verrouillées par une conciliation le sont déjà).
async function lierLignes(tx, transactionId, ligneIds) {
  const { count } = await tx.ligneEcriture.updateMany({
    where: { id: { in: ligneIds }, transactionBancaireId: null },
    data: { transactionBancaireId: transactionId },
  });
  if (count !== ligneIds.length) throw new Error("Une de ces lignes vient d'être associée à une autre transaction.");
  await tx.ligneEcriture.updateMany({ where: { id: { in: ligneIds }, rapprochementId: null }, data: { rapproche: true } });
}

async function associer(transactionId, ligneIds, nomUtilisateur) {
  const t = await chargerAExaminer(transactionId);
  const ids = [...new Set(ligneIds || [])];
  if (ids.length === 0) throw new Error("Choisis au moins une ligne.");
  const lignes = await prisma.ligneEcriture.findMany({ where: { id: { in: ids } } });
  if (lignes.length !== ids.length || lignes.some((l) => l.compteId !== t.compteTresorerie.compteId)) {
    throw new Error("Ces lignes ne sont pas sur ce compte.");
  }
  const total = lignes.reduce((s, l) => s + montantTitulaire(l), 0);
  if (!egal(total, t.montant)) {
    throw new Error(`Le total choisi (${total.toFixed(2)} $) ne correspond pas à la transaction (${t.montant.toFixed(2)} $).`);
  }
  await prisma.$transaction(async (tx) => {
    await lierLignes(tx, t.id, ids);
    await tx.transactionBancaire.update({ where: { id: t.id }, data: marquerExaminee("ASSOCIEE", nomUtilisateur) });
  });
}

// Relie la transaction aux lignes, sur son compte, d'une écriture que
// l'examen vient de créer (paiement, dépense, écriture, transfert).
async function lierEcritureCreee(t, where, statut, cree, nomUtilisateur) {
  const ecriture = await prisma.ecritureComptable.findFirst({ where, include: { lignes: true }, orderBy: { creeLe: "desc" } });
  const ligneIds = (ecriture?.lignes || []).filter((l) => l.compteId === t.compteTresorerie.compteId).map((l) => l.id);
  if (ligneIds.length === 0) throw new Error("L'écriture comptable n'a pas pu être créée.");
  await prisma.$transaction(async (tx) => {
    await lierLignes(tx, t.id, ligneIds);
    await tx.transactionBancaire.update({ where: { id: t.id }, data: marquerExaminee(statut, nomUtilisateur, cree) });
  });
}

function modePaiementPour(t) {
  if (t.reference) return "CHEQUE";
  return t.compteTresorerie.categorie === "CARTE_CREDIT" ? "CARTE_CREDIT" : null;
}

const champsPaiement = (t) => ({
  statut: "PAYEE",
  datePaiement: t.date,
  compteTresorerieId: t.compteTresorerieId,
  referenceVersement: t.reference || null,
  modePaiement: modePaiementPour(t),
});
const champsImpaye = { statut: "IMPAYEE", datePaiement: null, compteTresorerieId: null, referenceVersement: null, modePaiement: null };

async function payerDepense(transactionId, depenseId, nomUtilisateur) {
  const t = await chargerAExaminer(transactionId);
  await verifierPeriodeModifiable(t.date, { nouvellePiece: true });
  const depense = await prisma.depense.findUnique({ where: { id: depenseId } });
  if (!depense || depense.statut !== "IMPAYEE") throw new Error("Cette dépense n'est plus impayée.");
  if (!egal(depense.montant, -t.montant)) throw new Error("Le montant de la dépense ne correspond pas à la transaction.");

  const payee = await prisma.depense.update({ where: { id: depenseId }, data: champsPaiement(t) });
  try {
    await posterDepensePayee(payee, nomUtilisateur, t.compteTresorerie.compte.numero, payee.modePaiement);
    await lierEcritureCreee(t, { source: "DEPENSE_PAYEE", sourceId: depenseId }, "ASSOCIEE", { type: "PAIEMENT_DEPENSE", id: depenseId }, nomUtilisateur);
  } catch (e) {
    await prisma.ecritureComptable.deleteMany({ where: { source: "DEPENSE_PAYEE", sourceId: depenseId } });
    await prisma.depense.update({ where: { id: depenseId }, data: champsImpaye });
    throw e;
  }
}

async function payerFacture(transactionId, factureId, nomUtilisateur) {
  const t = await chargerAExaminer(transactionId);
  await verifierPeriodeModifiable(t.date, { nouvellePiece: true });
  const facture = await prisma.facture.findUnique({ where: { id: factureId } });
  if (!facture || facture.statut !== "IMPAYEE") throw new Error("Cette facture n'est plus impayée.");
  if (!egal(facture.totalAvecTaxes, t.montant)) throw new Error("Le montant de la facture ne correspond pas à la transaction.");

  const payee = await prisma.facture.update({ where: { id: factureId }, data: champsPaiement(t) });
  try {
    await posterFacturePayee(payee, nomUtilisateur, t.compteTresorerie.compte.numero, payee.modePaiement);
    await lierEcritureCreee(t, { source: "FACTURE_PAYEE", sourceId: factureId }, "ASSOCIEE", { type: "PAIEMENT_FACTURE", id: factureId }, nomUtilisateur);
  } catch (e) {
    await prisma.ecritureComptable.deleteMany({ where: { source: "FACTURE_PAYEE", sourceId: factureId } });
    await prisma.facture.update({ where: { id: factureId }, data: champsImpaye });
    throw e;
  }
}

// Taxes comprises dans le montant payé : sous-total = total ÷ (1 + taux),
// et le poste reçoit le reste pour que la dépense égale exactement la
// transaction malgré les arrondis.
function repartirTaxes(total, tpsTaux, tvqTaux) {
  const sousTotal = total / (1 + tpsTaux / 100 + tvqTaux / 100);
  const tps = arrondir(sousTotal * tpsTaux / 100);
  const tvq = arrondir(sousTotal * tvqTaux / 100);
  return { montant: arrondir(total - tps - tvq), tps, tvq };
}

async function ajouterDepense(transactionId, { fournisseurId, nouveauFournisseur, categorieDepenseId, description, taxesIncluses }, nomUtilisateur) {
  const t = await chargerAExaminer(transactionId);
  if (t.montant >= 0) throw new Error("Seule une sortie d'argent peut devenir une dépense.");
  await verifierPeriodeModifiable(t.date, { nouvellePiece: true });
  const categorie = categorieDepenseId ? await prisma.categorieDepense.findUnique({ where: { id: categorieDepenseId } }) : null;
  if (!categorie) throw new Error("Choisis un poste de dépense.");

  let idFournisseur = fournisseurId;
  if (!idFournisseur) {
    const nom = (nouveauFournisseur || "").trim();
    if (!nom) throw new Error("Choisis ou nomme le fournisseur.");
    const existant = await prisma.fournisseur.findFirst({ where: { nom: { equals: nom, mode: "insensitive" } } });
    idFournisseur = existant?.id || (await prisma.fournisseur.create({ data: { numero: await prochainNumeroFournisseur(), nom } })).id;
  }

  const total = -t.montant;
  let repartition = { montant: total, tps: 0, tvq: 0 };
  if (taxesIncluses) {
    const taux = Object.fromEntries((await prisma.parametre.findMany({ where: { cle: { in: ["tps_taux", "tvq_taux"] } } })).map((p) => [p.cle, Number(p.valeur)]));
    repartition = repartirTaxes(total, taux.tps_taux || 5, taux.tvq_taux || 9.975);
  }

  const depense = await prisma.$transaction((tx) => creerDepenseDansTransaction(tx, {
    fournisseurId: idFournisseur,
    description: (description || "").trim() || t.description,
    lignes: [{ categorieDepenseId, montant: repartition.montant }],
    tpsPayee: repartition.tps,
    tvqPayee: repartition.tvq,
    dateFacture: dateStr(t.date),
  }, nomUtilisateur));
  await comptabiliserDepenseRecue(depense, nomUtilisateur);

  try {
    const payee = await prisma.depense.update({ where: { id: depense.id }, data: champsPaiement(t) });
    await posterDepensePayee(payee, nomUtilisateur, t.compteTresorerie.compte.numero, payee.modePaiement);
    await lierEcritureCreee(t, { source: "DEPENSE_PAYEE", sourceId: depense.id }, "AJOUTEE", { type: "DEPENSE", id: depense.id }, nomUtilisateur);
  } catch (e) {
    await supprimerDepense(depense.id);
    throw e;
  }
}

async function supprimerDepense(depenseId) {
  await prisma.ecritureComptable.deleteMany({ where: { source: { in: ["DEPENSE_RECUE", "DEPENSE_PAYEE"] }, sourceId: depenseId } });
  await prisma.depense.deleteMany({ where: { id: depenseId } });
}

// Écriture entre le compte de la transaction et un autre compte du plan
// comptable (revenu, emprunt, apport…) ou un autre compte de trésorerie
// (transfert, paiement de la carte de crédit).
async function ajouterEcriture(transactionId, { compteNumero, description }, nomUtilisateur) {
  const t = await chargerAExaminer(transactionId);
  await verifierPeriodeModifiable(t.date, { nouvellePiece: true });
  const compteNumeroBanque = t.compteTresorerie.compte.numero;
  if (!compteNumero || compteNumero === compteNumeroBanque) throw new Error("Choisis l'autre compte.");
  const autre = await prisma.compte.findUnique({ where: { numero: compteNumero } });
  if (!autre) throw new Error("Compte introuvable.");

  const montant = Math.abs(t.montant);
  const texte = (description || "").trim() || t.description;
  const lignes = t.montant > 0
    ? [{ compteNumero: compteNumeroBanque, debit: montant, description: texte }, { compteNumero, credit: montant, description: texte }]
    : [{ compteNumero, debit: montant, description: texte }, { compteNumero: compteNumeroBanque, credit: montant, description: texte }];
  const ecriture = await enregistrerEcriture({
    date: t.date, description: texte, reference: t.reference, source: "TRANSACTION_BANCAIRE", sourceId: t.id, lignes, creePar: nomUtilisateur,
  });
  try {
    await lierEcritureCreee(t, { id: ecriture.id }, "AJOUTEE", { type: "ECRITURE", id: ecriture.id }, nomUtilisateur);
  } catch (e) {
    await prisma.ecritureComptable.deleteMany({ where: { id: ecriture.id } });
    throw e;
  }
}

async function transferer(transactionId, autreCompteTresorerieId, nomUtilisateur) {
  const t = await chargerAExaminer(transactionId);
  const autre = await prisma.compteTresorerie.findUnique({ where: { id: autreCompteTresorerieId || "" }, include: { compte: true } });
  if (!autre || autre.id === t.compteTresorerieId) throw new Error("Choisis l'autre compte du transfert.");
  const sens = t.montant > 0 ? `depuis ${autre.nom}` : `vers ${autre.nom}`;
  await ajouterEcriture(transactionId, { compteNumero: autre.compte.numero, description: `Transfert ${sens} — ${t.description}` }, nomUtilisateur);
}

async function exclure(transactionId, nomUtilisateur) {
  const t = await chargerAExaminer(transactionId);
  await prisma.transactionBancaire.update({ where: { id: t.id }, data: marquerExaminee("EXCLUE", nomUtilisateur) });
}

// Remet la transaction « à examiner » et défait ce que l'examen avait créé :
// la dépense ou l'écriture ajoutée est supprimée, la dépense ou facture
// payée redevient impayée, une simple association est seulement détachée.
async function annulerExamen(transactionId) {
  const t = await prisma.transactionBancaire.findUnique({ where: { id: transactionId }, include: { lignes: true } });
  if (!t) throw new Error("Transaction introuvable.");
  if (t.statut === "A_EXAMINER") return;
  if (t.lignes.some((l) => l.rapprochementId)) {
    throw new Error("Cette transaction fait partie d'une conciliation bancaire enregistrée — annule d'abord la conciliation.");
  }
  if (t.creeType) await verifierPeriodeModifiable(t.date, { nouvellePiece: false });

  if (t.creeType === "DEPENSE") {
    await supprimerDepense(t.creeId);
  } else if (t.creeType === "ECRITURE") {
    await prisma.ecritureComptable.deleteMany({ where: { id: t.creeId } });
  } else if (t.creeType === "PAIEMENT_DEPENSE") {
    await prisma.ecritureComptable.deleteMany({ where: { source: "DEPENSE_PAYEE", sourceId: t.creeId } });
    await prisma.depense.updateMany({ where: { id: t.creeId }, data: champsImpaye });
  } else if (t.creeType === "PAIEMENT_FACTURE") {
    await prisma.ecritureComptable.deleteMany({ where: { source: "FACTURE_PAYEE", sourceId: t.creeId } });
    await prisma.facture.updateMany({ where: { id: t.creeId }, data: champsImpaye });
  }

  await prisma.$transaction([
    prisma.ligneEcriture.updateMany({ where: { transactionBancaireId: t.id }, data: { transactionBancaireId: null, rapproche: false } }),
    prisma.transactionBancaire.update({
      where: { id: t.id },
      data: { statut: "A_EXAMINER", creeType: null, creeId: null, examineLe: null, examinePar: null },
    }),
  ]);
}

// Réponse d'erreur des routes : période verrouillée (423), message prévu
// pour l'utilisateur (400), ou erreur inattendue de la base (500).
function erreurPourReponse(e) {
  if (e.message?.startsWith("PERIODE_LOCK:")) return { erreur: e.message.replace("PERIODE_LOCK:", ""), status: 423 };
  if (e.name?.startsWith("Prisma")) {
    console.error("Erreur transactions bancaires :", e);
    return { erreur: "Erreur inattendue de la base de données.", status: 500 };
  }
  return { erreur: e.message, status: 400 };
}

module.exports = {
  erreurPourReponse,
  importerReleve, annulerImport, reparerStatuts, calculerSuggestions, obtenirCandidats,
  associer, payerDepense, payerFacture, ajouterDepense, ajouterEcriture, transferer, exclure, annulerExamen,
  repartirTaxes,
};
