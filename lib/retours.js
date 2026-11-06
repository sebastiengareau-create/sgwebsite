// Retour de pièce : un client rapporte une pièce achetée sur une facture
// précédente (retour, échange, garantie). La facture d'origine n'est jamais
// modifiée — le retour se fait sur un nouveau bon, comme à une caisse :
// - une ligne en quantité négative qui reprend la ligne vendue (retourDeId),
//   au prix réellement payé (escompte de la facture d'origine déduit) et à
//   son coûtant ; on ne peut pas retourner plus que ce qui a été vendu ;
// - la pièce revient en stock (mouvement RETOUR), sauf si elle est marquée
//   défectueuse (garantie, retour au fournisseur) : elle ne revient pas, et
//   son coût n'est pas renversé (coûtant 0 sur la ligne) ;
// - pour un échange, on ajoute la pièce de remplacement normalement.
// Les taxes du bon se calculent sur le net. Net négatif : la facture est à
// rembourser — gardée en crédit client ou rendue au client
// (reglerFactureNegative, lib/creditClient.js).
//
// Pièce hors inventaire (ligne fixe au compte 4010, lib/piecesSoumission.js) :
// même principe, avec une ligne fixe négative (retourDeProblemeId). La pièce
// rapportée est gardée : elle va sur une fiche d'inventaire, nouvelle ou
// existante (stock + quantité à son coûtant), et son coût est renversé à la
// facture (débit 1200 / crédit 5000). Défectueuse : ni fiche ni coût renversé.
//
// Pas de retour pour un kit ni une ligne B/O (contenu variable / jamais
// sortie du stock), ni sur un bon de véhicule à vendre.
const { prisma } = require("./prisma");
const { coutMoyenApresRetour } = require("./kits");
const COMPTE_PIECES_FIXES = "4010"; // lignes de pièces fixes (lib/piecesSoumission.js)

const arrondir = (n) => Math.round(n * 100) / 100;

// Part de la facture enlevée par son escompte (0 à 1)
function ratioEscompte(facture) {
  const avant = (facture.totalFacture || 0) + (facture.escompteApplique || 0);
  return avant > 0 ? (facture.escompteApplique || 0) / avant : 0;
}

// Prix unitaire réellement payé pour la ligne vendue
function prixPaye(ligne, facture) {
  return arrondir(ligne.prix * (1 - ratioEscompte(facture)));
}

// Quantité encore retournable d'une ligne vendue (retours = ses lignes de
// retour, sur n'importe quel bon, facturé ou non)
function qteRetournable(ligne) {
  return ligne.qte + (ligne.retours || []).reduce((s, r) => s + r.qte, 0);
}

const includeLigneVendue = {
  piece: { select: { id: true, nom: true, numero: true } },
  retours: { select: { qte: true } },
  probleme: { select: { bon: { select: { id: true, numero: true, clientId: true, facture: { select: { numero: true, statut: true, dateEmission: true, totalFacture: true, escompteApplique: true } } } } } },
};

function estVendueValide(ligne) {
  const f = ligne.probleme.bon.facture;
  return f && f.statut !== "ANNULEE" && ligne.qte > 0 && !ligne.retourDeId && !ligne.bo && !ligne.kit;
}

// Pièces vendues au client du bon sur ses factures, encore retournables —
// les plus récentes en premier
async function piecesRetournables(bonId) {
  const bon = await prisma.bonTravail.findUnique({ where: { id: bonId }, select: { clientId: true } });
  if (!bon) return [];
  const lignes = await prisma.pieceUtilisee.findMany({
    where: {
      retourDeId: null, bo: false, qte: { gt: 0 },
      probleme: { bon: { clientId: bon.clientId, id: { not: bonId }, facture: { statut: { in: ["IMPAYEE", "PAYEE"] } } } },
    },
    include: includeLigneVendue,
    take: 300,
  });
  const inventaire = lignes
    .filter((l) => estVendueValide(l) && qteRetournable(l) > 0)
    .map((l) => {
      const f = l.probleme.bon.facture;
      return {
        type: "INVENTAIRE", id: l.id, nom: l.piece.nom, numero: l.piece.numero, qteVendue: l.qte, qteRetournable: qteRetournable(l),
        prix: prixPaye(l, f), factureNumero: f.numero, dateFacture: f.dateEmission, bonNumero: l.probleme.bon.numero,
      };
    });
  const fixes = (await prisma.probleme.findMany({
    where: {
      categorieRevenu: COMPTE_PIECES_FIXES, retourDeProblemeId: null, factureQte: { gt: 0 }, pieces: { none: {} },
      bon: { clientId: bon.clientId, id: { not: bonId }, facture: { statut: { in: ["IMPAYEE", "PAYEE"] } } },
    },
    include: includeLigneFixeVendue,
    take: 300,
  }))
    .filter((pr) => estLigneFixeVendueValide(pr) && qteRetournableFixe(pr) >= 1)
    .map((pr) => {
      const f = pr.bon.facture;
      return {
        type: "HORS_INVENTAIRE", id: pr.id, nom: pr.description, numero: null, qteVendue: pr.factureQte,
        qteRetournable: Math.floor(qteRetournableFixe(pr) + 1e-9), prix: prixPayeFixe(pr, f), coutant: pr.factureCoutant ?? 0,
        prixVendant: pr.facturePrixUnitaire || 0, factureNumero: f.numero, dateFacture: f.dateEmission, bonNumero: pr.bon.numero,
      };
    });
  return [...inventaire, ...fixes].sort((a, b) => new Date(b.dateFacture) - new Date(a.dateFacture));
}

// ---------- Pièces hors inventaire (lignes fixes 4010) ----------

const includeLigneFixeVendue = {
  retours: { select: { factureQte: true } },
  _count: { select: { pieces: true } },
  bon: { select: { id: true, numero: true, clientId: true, facture: { select: { numero: true, statut: true, dateEmission: true, totalFacture: true, escompteApplique: true } } } },
};

function estLigneFixeVendueValide(pr) {
  const f = pr.bon.facture;
  return f && f.statut !== "ANNULEE" && pr.categorieRevenu === COMPTE_PIECES_FIXES && !pr.retourDeProblemeId
    && (pr.factureQte ?? 1) > 0 && pr._count.pieces === 0;
}

function qteRetournableFixe(pr) {
  return (pr.factureQte ?? 1) + (pr.retours || []).reduce((s, r) => s + (r.factureQte ?? 0), 0);
}

function prixPayeFixe(pr, facture) {
  return arrondir((pr.facturePrixUnitaire || 0) * (1 - ratioEscompte(facture)));
}

// Retour d'une pièce hors inventaire sur le bon (dans tx). bon doit inclure
// client. fiche : { pieceId } (fiche existante) ou { nouvelle: { nom, numero } }
// — ignorée si defectueuse.
async function ajouterRetourHorsInventaire(tx, { bon, ligneOrigineId, quantite, defectueuse = false, fiche = {}, creePar = null }) {
  if (bon.vehiculeVenteId) throw new Error("Un bon de véhicule à vendre ne prend pas de retour.");
  const q = Number(quantite);
  if (!Number.isInteger(q) || q < 1) throw new Error("Quantité invalide (nombre entier).");
  const origine = await tx.probleme.findUnique({ where: { id: ligneOrigineId }, include: includeLigneFixeVendue });
  if (!origine || !estLigneFixeVendueValide(origine)) throw new Error("Cette pièce ne peut pas être retournée (facture annulée ou ligne invalide).");
  if (origine.bon.clientId !== bon.clientId) throw new Error("Cette pièce a été vendue à un autre client.");
  if (origine.bon.id === bon.id) throw new Error("Cette pièce est sur ce même bon — retire-la plutôt.");
  const restant = qteRetournableFixe(origine);
  if (q > restant + 1e-9) throw new Error(`Seulement ${Math.floor(restant + 1e-9)} encore retournable${restant >= 2 ? "s" : ""} sur la facture ${origine.bon.facture.numero}.`);

  const coutant = origine.factureCoutant ?? 0;
  let piece = null;
  if (!defectueuse) {
    if (fiche.pieceId) {
      piece = await tx.piece.findUnique({ where: { id: fiche.pieceId } });
      if (!piece || !piece.actif || piece.estKit) throw new Error("Fiche d'inventaire introuvable ou désactivée.");
    } else {
      const nom = String(fiche.nouvelle?.nom || "").trim();
      const numero = String(fiche.nouvelle?.numero || "").trim();
      if (!nom || !numero) throw new Error("Donne un nom et un numéro à la nouvelle fiche d'inventaire.");
      if (await tx.piece.findUnique({ where: { numero } })) throw new Error(`Le numéro « ${numero} » existe déjà — choisis cette fiche plutôt.`);
      piece = await tx.piece.create({ data: { nom, numero, prix: origine.facturePrixUnitaire || 0, coutant, qte: 0 } });
    }
    const nouvelleQte = piece.qte + q;
    await tx.piece.update({
      where: { id: piece.id },
      data: {
        qte: nouvelleQte,
        coutant: coutMoyenApresRetour(piece, q, coutant),
        mouvements: {
          create: {
            type: "RETOUR", qte: q, solde: nouvelleQte, creePar,
            note: `Retour (pièce hors inventaire) — Bon #${bon.numero} — ${bon.client.nom} (facture ${origine.bon.facture.numero})`,
          },
        },
      },
    });
  }
  return tx.probleme.create({
    data: {
      bonId: bon.id, description: origine.description, categorieRevenu: COMPTE_PIECES_FIXES, factureDescription: "Pièce",
      factureQte: -q, facturePrixUnitaire: prixPayeFixe(origine, origine.bon.facture), factureCoutant: defectueuse ? 0 : coutant,
      retourDeProblemeId: origine.id, retourFacture: origine.bon.facture.numero, defectueuse, retourPieceId: piece?.id ?? null,
    },
  });
}

// Ligne de retour hors inventaire retirée du bon (avant facture) : la pièce
// ressort de la fiche où elle avait été mise (la fiche reste)
async function annulerRetourHorsInventaire(tx, ligne, { note, creePar }) {
  if (!ligne.retourPieceId) return;
  const piece = await tx.piece.findUnique({ where: { id: ligne.retourPieceId } });
  const nouvelleQte = piece.qte + (ligne.factureQte ?? 0); // négative
  await tx.piece.update({
    where: { id: piece.id },
    data: { qte: nouvelleQte, mouvements: { create: { type: "RETOUR", qte: Math.round(ligne.factureQte ?? 0), solde: nouvelleQte, note, creePar } } },
  });
}

// Ajoute un retour de `quantite` de la ligne vendue ligneOrigineId sur une
// tâche du bon (dans la transaction tx). probleme doit inclure bon.client.
async function ajouterRetour(tx, { probleme, ligneOrigineId, quantite, defectueuse = false, creePar = null }) {
  const bon = probleme.bon;
  if (bon.vehiculeVenteId) throw new Error("Un bon de véhicule à vendre ne prend pas de retour.");
  const q = Number(quantite);
  if (!Number.isInteger(q) || q < 1) throw new Error("Quantité invalide.");
  const origine = await tx.pieceUtilisee.findUnique({ where: { id: ligneOrigineId }, include: includeLigneVendue });
  if (!origine || !estVendueValide(origine)) throw new Error("Cette pièce ne peut pas être retournée (facture annulée, kit ou B/O).");
  if (origine.probleme.bon.clientId !== bon.clientId) throw new Error("Cette pièce a été vendue à un autre client.");
  if (origine.probleme.bon.id === bon.id) throw new Error("Cette pièce est sur ce même bon — retire-la plutôt.");
  const restant = qteRetournable(origine);
  if (q > restant) throw new Error(`Seulement ${restant} encore retournable${restant > 1 ? "s" : ""} sur la facture ${origine.probleme.bon.facture.numero}.`);

  const coutant = origine.coutant ?? (await tx.piece.findUnique({ where: { id: origine.pieceId } })).coutant;
  if (!defectueuse) {
    const piece = await tx.piece.findUnique({ where: { id: origine.pieceId } });
    const nouvelleQte = piece.qte + q;
    await tx.piece.update({
      where: { id: piece.id },
      data: {
        qte: nouvelleQte,
        coutant: coutMoyenApresRetour(piece, q, coutant),
        mouvements: {
          create: {
            type: "RETOUR", qte: q, solde: nouvelleQte, creePar,
            note: `Retour — Bon #${bon.numero} — ${bon.client.nom} (facture ${origine.probleme.bon.facture.numero})`,
          },
        },
      },
    });
  }
  return tx.pieceUtilisee.create({
    data: {
      problemeId: probleme.id, pieceId: origine.pieceId, qte: -q,
      prix: prixPaye(origine, origine.probleme.bon.facture),
      coutant: defectueuse ? 0 : coutant,
      retourDeId: origine.id, retourFacture: origine.probleme.bon.facture.numero, defectueuse,
    },
  });
}

// Ligne de retour retirée du bon (avant facture) : la pièce ressort du stock
// si elle y était revenue
async function annulerRetourEnStock(tx, ligne, { note, creePar }) {
  if (ligne.defectueuse) return;
  const piece = await tx.piece.findUnique({ where: { id: ligne.pieceId } });
  const nouvelleQte = piece.qte + ligne.qte; // ligne.qte est négative
  await tx.piece.update({
    where: { id: piece.id },
    data: { qte: nouvelleQte, mouvements: { create: { type: "RETOUR", qte: ligne.qte, solde: nouvelleQte, note, creePar } } },
  });
}

module.exports = { piecesRetournables, ajouterRetour, annulerRetourEnStock, ajouterRetourHorsInventaire, annulerRetourHorsInventaire, prixPaye, qteRetournable };
