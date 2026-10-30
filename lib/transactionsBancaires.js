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
// Chaque ajout est retenu (RegleBancaire) : la prochaine transaction qui lui
// ressemble est proposée avec le même classement, à confirmer.
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
// Une correspondance est « trouvée » (sûre) quand c'est la seule écriture du
// même montant et qu'elle est à quelques jours près, ou que le numéro de
// chèque concorde ; sinon elle est « possible », à vérifier.
const JOURS_CERTITUDE = 5;

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

// Doublons : une transaction est déjà importée si sa clé (date, montant,
// description) existe, ou si la banque a déjà donné son FITID à une
// transaction du même montant à quelques jours près — la banque a alors
// seulement changé la description. Un FITID repris pour une autre
// transaction (montant ou date différents) ne compte pas : certaines
// banques réutilisent leurs identifiants.
//
// Retourne { choixCompte } si le fichier contient plusieurs comptes et
// qu'aucun n'a été choisi (`numeroCompte`) — l'écran demande alors lequel.
async function importerReleve({ compteTresorerieId, octets, nomFichier, numeroCompte, nomUtilisateur }) {
  const compte = await prisma.compteTresorerie.findUnique({ where: { id: compteTresorerieId } });
  if (!compte) throw new Error("Compte introuvable.");

  const { format, comptes } = lireReleve(octets, nomFichier);
  let releve = comptes[0];
  if (comptes.length > 1) {
    releve = comptes.find((c) => c.numero === numeroCompte);
    if (!releve) return { choixCompte: comptes.map((c) => ({ numero: c.numero, nombre: c.transactions.length })) };
  }

  const cles = clesTransactions(releve.transactions);
  const fitids = releve.transactions.map((t) => t.fitid).filter(Boolean);
  const [parCle, parFitid] = await Promise.all([
    prisma.transactionBancaire.findMany({ where: { compteTresorerieId, cle: { in: cles } }, select: { cle: true } }),
    fitids.length > 0
      ? prisma.transactionBancaire.findMany({ where: { compteTresorerieId, fitid: { in: fitids } }, select: { fitid: true, date: true, montant: true } })
      : [],
  ]);
  const clesExistantes = new Set(parCle.map((t) => t.cle));
  const memeFitid = (t) => parFitid.some((e) => e.fitid === t.fitid && egal(e.montant, t.montant)
    && Math.abs(new Date(e.date).getTime() - jourCivil(t.date).getTime()) <= 3 * JOUR);

  const nouvelles = releve.transactions
    .map((t, i) => ({ ...t, cle: cles[i] }))
    .filter((t) => !clesExistantes.has(t.cle) && !(t.fitid && memeFitid(t)));

  // Solde du relevé (fichier OFX, ou colonne Solde d'un CSV), dans le sens
  // de la conciliation — une carte de crédit montre le solde dû en positif.
  const solde = releve.solde ? { montant: sensCompte(compte.categorie) * releve.solde.montant, date: releve.solde.date } : null;
  const dates = releve.transactions.map((t) => t.date).sort();

  const importBancaire = await prisma.$transaction(async (tx) => {
    const cree = await tx.importBancaire.create({
      data: {
        compteTresorerieId,
        nomFichier: nomFichier || "fichier",
        format,
        numeroCompte: comptes.length > 1 ? releve.numero : null,
        contenu: octets,
        nbLues: releve.transactions.length,
        nbImportees: nouvelles.length,
        nbDoublons: releve.transactions.length - nouvelles.length,
        debut: dates.length > 0 ? jourCivil(dates[0]) : null,
        fin: dates.length > 0 ? jourCivil(dates[dates.length - 1]) : null,
        soldeBanque: solde?.montant ?? null,
        soldeLe: solde ? jourCivil(solde.date) : null,
        importePar: nomUtilisateur || null,
      },
    });
    await tx.transactionBancaire.createMany({
      data: nouvelles.map((t) => ({
        compteTresorerieId,
        date: jourCivil(t.date),
        montant: t.montant,
        description: t.description,
        reference: t.reference,
        cle: t.cle,
        fitid: t.fitid || null,
        importId: cree.id,
      })),
      skipDuplicates: true,
    });
    return cree;
  });

  // Le solde importé remplace le solde relevé à la main s'il est plus récent
  let soldeMisAJour = null;
  if (solde && (!compte.soldeReleveLe || jourCivil(solde.date) >= compte.soldeReleveLe)) {
    soldeMisAJour = solde;
    await prisma.compteTresorerie.update({
      where: { id: compteTresorerieId },
      data: { soldeReleve: solde.montant, soldeReleveLe: jourCivil(solde.date) },
    });
  }

  return {
    importId: importBancaire.id,
    importees: nouvelles.length,
    dejaImportees: releve.transactions.length - nouvelles.length,
    debut: dates[0],
    fin: dates[dates.length - 1],
    solde: soldeMisAJour,
  };
}

// Retire les transactions d'un import qui n'ont pas encore été examinées
// (mauvais compte choisi, mauvais fichier) — celles déjà reliées restent.
// L'import reste dans l'historique, marqué annulé.
async function annulerImport(importId, nomUtilisateur) {
  const { count } = await prisma.transactionBancaire.deleteMany({ where: { importId, statut: "A_EXAMINER" } });
  await prisma.importBancaire.updateMany({ where: { id: importId }, data: { annuleLe: new Date(), annulePar: nomUtilisateur || null } });
  return count;
}

// Une écriture supprimée ailleurs (dépense corrigée ou supprimée, facture
// annulée…) emporte ses lignes : la transaction qui y était reliée retourne
// « à examiner » plutôt que de rester reliée à rien.
async function reparerStatuts(compteTresorerieId) {
  const orphelines = await prisma.transactionBancaire.findMany({
    where: { compteTresorerieId, statut: { in: ["ASSOCIEE", "AJOUTEE"] }, lignes: { none: {} } },
    select: { id: true, journal: true },
  });
  for (const t of orphelines) {
    await prisma.transactionBancaire.update({
      where: { id: t.id },
      data: { statut: "A_EXAMINER", creeType: null, creeId: null, examineLe: null, examinePar: null, journal: entreeJournal(t, "DETACHEE", null) },
    });
  }
}

// ---------- CLASSEMENTS APPRIS ----------

// Mots qui ne disent rien de la contrepartie : type d'opération, canal,
// mots de liaison, provinces. Les mots avec des chiffres (numéro de
// magasin, de carte, de référence) sont aussi écartés.
const MOTS_VIDES = new Set([
  "PAIEMENT", "PAIEMENTS", "PMT", "FACTURE", "FACT", "ACHAT", "ACHATS", "DEPOT", "DEPOTS", "RETRAIT", "RETRAITS",
  "VIREMENT", "VIR", "TRANSFERT", "INTERAC", "TPV", "PDV", "POS", "DEBIT", "CREDIT", "PREAUTORISE", "PREAUT", "PAP", "DPA",
  "CHEQUE", "CHQ", "CARTE", "ACCESD", "INTERNET", "LIGNE", "MOBILE", "BANQUE", "MERCI", "PURCHASE", "PAYMENT", "DEPOSIT",
  "WITHDRAWAL", "TRANSFER", "BILL", "PAY", "EFT", "ETRANSFER", "SEND", "MONEY", "ONLINE", "BANKING", "BRANCH",
  "AU", "AUX", "DU", "DE", "DES", "LA", "LE", "LES", "ET", "EN", "PAR", "POUR", "THE", "AND", "TO", "FROM", "OF",
  "QC", "ON", "BC", "AB", "NB", "NS", "CA", "CAN", "CAD", "INC", "LTEE", "LTD", "CIE", "NO", "NUM", "REF",
]);

function motsSignificatifs(description) {
  const mots = String(description || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ").split(" ")
    .filter((m) => m.length >= 2 && !/\d/.test(m) && !MOTS_VIDES.has(m));
  return [...new Set(mots)];
}

const signature = (description) => motsSignificatifs(description).slice(0, 6).join(" ");

// Retient le classement choisi pour cette transaction (ou le met à jour,
// le plus récent l'emporte). Un échec n'empêche jamais l'ajout lui-même.
async function apprendre(t, choix) {
  const sig = signature(t.description);
  if (!sig) return;
  const sens = t.montant > 0 ? 1 : -1;
  const valeurs = {
    action: choix.action,
    fournisseurId: choix.fournisseurId || null,
    categorieDepenseId: choix.categorieDepenseId || null,
    taxesIncluses: !!choix.taxesIncluses,
    compteNumero: choix.compteNumero || null,
    description: choix.description || null,
  };
  try {
    await prisma.regleBancaire.upsert({
      where: { signature_sens: { signature: sig, sens } },
      update: { ...valeurs, utilisations: { increment: 1 }, derniereUtilisation: new Date() },
      create: { signature: sig, sens, ...valeurs },
    });
  } catch (e) {
    console.error("Erreur classement appris :", e);
  }
}

// Classement appris qui ressemble le plus à la transaction : au moins 60 %
// des mots du classement se retrouvent dans sa description (« PETRO CANADA
// MONTREAL » reconnaît « PETRO-CANADA 999 LAVAL »).
function trouverRegle(t, regles, compteNumeroBanque) {
  const mots = new Set(motsSignificatifs(t.description));
  const sens = t.montant > 0 ? 1 : -1;
  let meilleure = null;
  for (const r of regles) {
    if (r.sens !== sens) continue;
    if (r.action === "DEPENSE" && (!r.fournisseur?.actif || !r.categorieDepense?.actif)) continue;
    if (r.action === "ECRITURE" && (!r.compteNumero || r.compteNumero === compteNumeroBanque)) continue;
    const motsRegle = r.signature.split(" ");
    const communs = motsRegle.filter((m) => mots.has(m)).length;
    const score = communs / motsRegle.length;
    if (score < 0.6) continue;
    // Départage : plus de mots en commun, puis le plus utilisé, puis le plus récent
    const rang = [score, communs, r.utilisations, new Date(r.derniereUtilisation).getTime()];
    if (!meilleure || passeDevant(rang, meilleure.rang)) meilleure = { regle: r, rang };
  }
  return meilleure?.regle || null;
}

function passeDevant(a, b) {
  const i = a.findIndex((v, j) => v !== b[j]);
  return i >= 0 && a[i] > b[i];
}

const chargerRegles = () => prisma.regleBancaire.findMany({
  include: { fournisseur: { select: { nom: true, actif: true } }, categorieDepense: { select: { nom: true, actif: true } } },
});

function suggestionRegle(r, comptesParNumero) {
  return {
    type: "REGLE",
    certitude: "APPRISE",
    regleId: r.id,
    action: r.action,
    fournisseurId: r.fournisseurId,
    categorieDepenseId: r.categorieDepenseId,
    taxesIncluses: r.taxesIncluses,
    compteNumero: r.compteNumero,
    description: r.action === "DEPENSE"
      ? `${r.fournisseur.nom} · ${r.categorieDepense.nom}${r.taxesIncluses ? " · taxes incluses" : ""}`
      : `${r.compteNumero} · ${comptesParNumero[r.compteNumero] || ""}`,
  };
}

async function oublierRegle(regleId) {
  await prisma.regleBancaire.deleteMany({ where: { id: regleId } });
}

// ---------- SUGGESTIONS ----------

// Une suggestion par transaction à examiner :
// - la ligne d'écriture du même montant la plus proche en date (le numéro de
//   chèque l'emporte), « SURE » ou « POSSIBLE » (voir JOURS_CERTITUDE) ;
// - sinon une dépense ou facture impayée du même montant (« POSSIBLE » :
//   enregistrer le paiement se confirme une à une) ;
// - sinon un classement appris (« APPRISE »).
// Chaque ligne ou pièce n'est proposée qu'une fois — les paires les plus
// proches sont servies d'abord, pour que des frais mensuels identiques
// tombent chacun sur leur mois.
async function calculerSuggestions(compteTresorerie, transactions) {
  if (transactions.length === 0) return {};
  const temps = transactions.map((t) => new Date(t.date).getTime());
  const debut = new Date(Math.min(...temps) - JOURS_AVANT * JOUR);
  const fin = new Date(Math.max(...temps) + JOURS_APRES * JOUR);
  const estCarte = compteTresorerie.categorie === "CARTE_CREDIT";

  const [lignes, depenses, factures, regles, comptes, compteGl] = await Promise.all([
    prisma.ligneEcriture.findMany({
      where: { compteId: compteTresorerie.compteId, transactionBancaireId: null, ecriture: { date: { gte: debut, lte: fin } } },
      include: { ecriture: { select: { numero: true, date: true, description: true } } },
    }),
    prisma.depense.findMany({ where: { statut: "IMPAYEE" }, include: { fournisseur: { select: { nom: true } } } }),
    estCarte ? [] : prisma.facture.findMany({
      where: { statut: "IMPAYEE" },
      select: { id: true, numero: true, totalAvecTaxes: true, dateEmission: true, bon: { select: { client: { select: { nom: true } } } } },
    }),
    chargerRegles(),
    prisma.compte.findMany({ where: { actif: true }, select: { numero: true, nom: true } }),
    prisma.compte.findUnique({ where: { id: compteTresorerie.compteId }, select: { numero: true } }),
  ]);
  const comptesParNumero = Object.fromEntries(comptes.map((c) => [c.numero, c.nom]));

  const paires = [];
  for (const t of transactions) {
    const tTemps = new Date(t.date).getTime();
    const pairesLignes = [];
    for (const l of lignes) {
      if (!egal(montantTitulaire(l), t.montant)) continue;
      const ecart = (new Date(l.ecriture.date).getTime() - tTemps) / JOUR;
      if (ecart < -JOURS_AVANT || ecart > JOURS_APRES) continue;
      const chequeTrouve = t.reference && `${l.ecriture.description} ${l.description || ""}`.includes(t.reference);
      pairesLignes.push({
        t, cle: `L${l.id}`, score: Math.abs(ecart) - (chequeTrouve ? 100 : 0), chequeTrouve, ecart,
        suggestion: { type: "LIGNE", ligneId: l.id, numero: l.ecriture.numero, date: dateStr(l.ecriture.date), description: l.description || l.ecriture.description },
      });
    }
    for (const p of pairesLignes) {
      const sure = p.chequeTrouve || (Math.abs(p.ecart) <= JOURS_CERTITUDE && pairesLignes.length === 1);
      p.suggestion.certitude = sure ? "SURE" : "POSSIBLE";
      paires.push(p);
    }
    if (t.montant < 0) {
      for (const d of depenses) {
        const ecart = (new Date(d.dateFacture).getTime() - tTemps) / JOUR;
        if (!egal(d.montant, -t.montant) || ecart > 5 || ecart < -365) continue;
        paires.push({
          t, cle: `D${d.id}`, score: 1000 + Math.abs(ecart),
          suggestion: { type: "DEPENSE", certitude: "POSSIBLE", depenseId: d.id, date: dateStr(d.dateFacture), description: `${d.fournisseur.nom} — ${d.description}` },
        });
      }
    } else {
      for (const f of factures) {
        const ecart = (new Date(f.dateEmission).getTime() - tTemps) / JOUR;
        if (!egal(f.totalAvecTaxes, t.montant) || ecart > 5 || ecart < -365) continue;
        paires.push({
          t, cle: `F${f.id}`, score: 1000 + Math.abs(ecart),
          suggestion: { type: "FACTURE", certitude: "POSSIBLE", factureId: f.id, numero: f.numero, date: dateStr(f.dateEmission), description: f.bon?.client?.nom || "" },
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
  for (const t of transactions) {
    if (suggestions[t.id]) continue;
    const regle = trouverRegle(t, regles, compteGl?.numero);
    if (regle) suggestions[t.id] = suggestionRegle(regle, comptesParNumero);
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

const entreeJournal = (t, action, nomUtilisateur) => [
  ...(Array.isArray(t.journal) ? t.journal : []),
  { le: new Date().toISOString(), par: nomUtilisateur || null, action },
];

const marquerExaminee = (t, statut, nomUtilisateur, cree = {}) => ({
  statut,
  creeType: cree.type || null,
  creeId: cree.id || null,
  examineLe: new Date(),
  examinePar: nomUtilisateur || null,
  journal: entreeJournal(t, cree.type || statut, nomUtilisateur),
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
    await tx.transactionBancaire.update({ where: { id: t.id }, data: marquerExaminee(t, "ASSOCIEE", nomUtilisateur) });
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
    await tx.transactionBancaire.update({ where: { id: t.id }, data: marquerExaminee(t, statut, nomUtilisateur, cree) });
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

  const texte = (description || "").trim() || t.description;
  const depense = await prisma.$transaction((tx) => creerDepenseDansTransaction(tx, {
    fournisseurId: idFournisseur,
    description: texte,
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
  await apprendre(t, {
    action: "DEPENSE", fournisseurId: idFournisseur, categorieDepenseId, taxesIncluses,
    description: texte !== t.description ? texte : null,
  });
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
  // Une description bâtie sur celle de la banque (transfert) ne vaut que
  // pour cette transaction-ci
  await apprendre(t, { action: "ECRITURE", compteNumero, description: texte.includes(t.description) ? null : texte });
}

async function transferer(transactionId, autreCompteTresorerieId, nomUtilisateur) {
  const t = await chargerAExaminer(transactionId);
  const autre = await prisma.compteTresorerie.findUnique({ where: { id: autreCompteTresorerieId || "" }, include: { compte: true } });
  if (!autre || autre.id === t.compteTresorerieId) throw new Error("Choisis l'autre compte du transfert.");
  const sens = t.montant > 0 ? `depuis ${autre.nom}` : `vers ${autre.nom}`;
  await ajouterEcriture(transactionId, { compteNumero: autre.compte.numero, description: `Transfert ${sens} — ${t.description}` }, nomUtilisateur);
}

// Confirme un classement appris : refait le même ajout que la dernière fois
async function appliquerRegle(transactionId, regleId, nomUtilisateur) {
  const regle = await prisma.regleBancaire.findUnique({ where: { id: regleId || "" } });
  if (!regle) throw new Error("Ce classement appris n'existe plus.");
  if (regle.action === "DEPENSE") {
    await ajouterDepense(transactionId, {
      fournisseurId: regle.fournisseurId, categorieDepenseId: regle.categorieDepenseId, taxesIncluses: regle.taxesIncluses, description: regle.description,
    }, nomUtilisateur);
  } else {
    await ajouterEcriture(transactionId, { compteNumero: regle.compteNumero, description: regle.description }, nomUtilisateur);
  }
}

async function exclure(transactionId, nomUtilisateur) {
  const t = await chargerAExaminer(transactionId);
  await prisma.transactionBancaire.update({ where: { id: t.id }, data: marquerExaminee(t, "EXCLUE", nomUtilisateur) });
}

// Remet la transaction « à examiner » et défait ce que l'examen avait créé :
// la dépense ou l'écriture ajoutée est supprimée, la dépense ou facture
// payée redevient impayée, une simple association est seulement détachée.
// L'annulation reste inscrite au journal de la transaction.
async function annulerExamen(transactionId, nomUtilisateur) {
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
      data: { statut: "A_EXAMINER", creeType: null, creeId: null, examineLe: null, examinePar: null, journal: entreeJournal(t, "ANNULEE", nomUtilisateur) },
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
  associer, payerDepense, payerFacture, ajouterDepense, ajouterEcriture, transferer, appliquerRegle, exclure, annulerExamen,
  oublierRegle, signature, repartirTaxes,
};
