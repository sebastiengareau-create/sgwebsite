// Kits (ex. « Changement d'huile ») : une fiche d'inventaire (Piece.estKit)
// facturée à son propre prix, faite de pièces d'inventaire et de
// main-d'œuvre (ComposantKit). Le kit n'a pas de stock à lui : l'ajouter à
// un bon sort chacune de ses pièces du stock, et la ligne du bon garde ce
// contenu figé (PieceUtilisee.kit) pour remettre en stock exactement ce qui
// en est sorti si on la modifie ou la retire.
//
// Main-d'œuvre : comprise dans le prix du kit (forfait). Une tâche du bon
// qui contient un kit avec de la main-d'œuvre ne facture donc pas ses heures
// poinçonnées — elles restent pour la paie (voir heuresFacturablesTache).
// Client et serveur.

const arrondi = (n) => Math.round(n * 10000) / 10000;

// Coûtant d'un kit (composants inclus, avec leur pièce) : pièces au coût
// moyen actuel + main-d'œuvre (heures × coût horaire).
export function coutantKit(composants) {
  let pieces = 0;
  let mainOeuvre = 0;
  let heures = 0;
  for (const c of composants || []) {
    if (c.pieceId) pieces += c.qte * (c.piece?.coutant || 0);
    else {
      heures += c.qte;
      mainOeuvre += c.qte * (c.coutHoraire || 0);
    }
  }
  return { pieces, mainOeuvre, heures, total: pieces + mainOeuvre };
}

// Nombre de kits qu'on peut faire avec le stock actuel (composants inclus,
// avec leur pièce) — null si le kit ne contient aucune pièce (illimité).
export function kitsDisponibles(composants) {
  const pieces = (composants || []).filter((c) => c.pieceId && c.qte > 0);
  if (pieces.length === 0) return null;
  return Math.max(0, Math.min(...pieces.map((c) => Math.floor((c.piece?.qte || 0) / c.qte))));
}

// Tâche dont la main-d'œuvre est comprise dans un kit (forfait)
export function tacheAuForfait(probleme) {
  return (probleme.pieces || []).some((l) => l.kit?.heures > 0);
}

// Heures facturées au client pour une tâche : les heures poinçonnées
// terminées, seulement sur le poste Main-d'œuvre et hors forfait d'un kit.
export function heuresFacturablesTache(probleme) {
  if ((probleme.categorieRevenu || "MAIN_OEUVRE") !== "MAIN_OEUVRE" || tacheAuForfait(probleme)) return 0;
  return (probleme.entreesTemps || [])
    .filter((t) => t.fin)
    .reduce((s, t) => s + (new Date(t.fin) - new Date(t.debut)) / 3600000, 0);
}

// Des pièces qui reviennent en stock y rentrent à leur coût figé sur la ligne
// (pas au coût moyen actuel) : le coût moyen de la pièce est recalculé pour
// que la valeur du stock reste exactement égale à celle du grand livre.
export function coutMoyenApresRetour(piece, qteRetour, coutLigne) {
  const qteTotale = piece.qte + qteRetour;
  return qteTotale > 0 ? (piece.qte * piece.coutant + qteRetour * coutLigne) / qteTotale : piece.coutant;
}

// Coût des pièces d'un kit, selon son contenu figé
function coutPiecesFige(contenu) {
  return contenu.composants.reduce((s, c) => s + c.qte * c.coutant, 0);
}

// Ajoute `quantite` kits à une tâche du bon (dans la transaction tx) : chaque
// pièce du kit sort du stock (mouvement de vente), et une ligne au prix du
// kit est créée avec son contenu figé. Toujours une nouvelle ligne : deux
// ajouts du même kit peuvent avoir un contenu différent si le kit a changé.
// probleme doit inclure bon.client.
export async function sortirKitDuStockPourBon(tx, { probleme, kit, quantite, creePar }) {
  const composants = await tx.composantKit.findMany({ where: { kitId: kit.id }, include: { piece: true }, orderBy: { ordre: "asc" } });
  const contenu = { composants: [], heures: 0 };
  for (const c of composants) {
    if (!c.pieceId) {
      contenu.heures += c.qte;
      continue;
    }
    const sortie = c.qte * quantite;
    if (c.piece.qte < sortie) throw new Error(`STOCK_KIT:${c.piece.nom}`);
    const nouvelleQte = c.piece.qte - sortie;
    await tx.piece.update({
      where: { id: c.pieceId },
      data: {
        qte: nouvelleQte,
        mouvements: {
          create: {
            type: "VENTE", qte: -sortie, solde: nouvelleQte,
            note: `Bon #${probleme.bon.numero} — ${probleme.bon.client.nom} (kit ${kit.nom})`, creePar,
          },
        },
      },
    });
    contenu.composants.push({ pieceId: c.pieceId, nom: c.piece.nom, qte: c.qte, coutant: c.piece.coutant });
  }
  return tx.pieceUtilisee.create({
    data: { problemeId: probleme.id, pieceId: kit.id, qte: quantite, prix: kit.prix, coutant: coutPiecesFige(contenu), kit: contenu },
  });
}

// Change le nombre de kits d'une ligne (0 = la ligne est retirée) : la
// différence de chaque pièce sort du stock au coût moyen actuel, ou y
// revient à son coût figé. Renvoie { coutant, kit } à enregistrer sur la
// ligne. ligne doit inclure probleme.bon.client.
export async function ajusterKitSurBon(tx, ligne, nouvelleQte, { creePar, note }) {
  const difference = nouvelleQte - ligne.qte; // positif = plus de kits
  const contenu = { ...ligne.kit, composants: [] };
  for (const c of ligne.kit.composants) {
    const delta = c.qte * difference; // pièces à sortir (positif) ou à remettre (négatif)
    const piece = await tx.piece.findUnique({ where: { id: c.pieceId } });
    if (!piece) throw new Error(`STOCK_KIT:${c.nom}`); // pièce supprimée depuis
    if (delta > 0 && piece.qte < delta) throw new Error(`STOCK_KIT:${piece.nom}`);
    const qteApres = piece.qte - delta;
    await tx.piece.update({
      where: { id: piece.id },
      data: {
        qte: qteApres,
        ...(delta < 0 && { coutant: coutMoyenApresRetour(piece, -delta, c.coutant) }),
        mouvements: { create: { type: "VENTE", qte: -delta, solde: qteApres, note, creePar } },
      },
    });
    // Plus de kits : les pièces ajoutées sortent au coût moyen actuel, la
    // ligne garde un coût moyen pondéré. Kits rendus : retour au coût figé.
    const coutant = difference > 0 ? (ligne.qte * c.coutant + difference * piece.coutant) / nouvelleQte : c.coutant;
    contenu.composants.push({ ...c, coutant });
  }
  return { coutant: coutPiecesFige(contenu), kit: contenu };
}

// Contenu d'une ligne de kit, en texte : « Huile 5W30 ×5, Filtre ×1, 0,5 h »
export function libelleContenuKit(contenu) {
  if (!contenu) return "";
  const parties = contenu.composants.map((c) => `${c.nom} ×${c.qte}`);
  if (contenu.heures > 0) parties.push(`${String(arrondi(contenu.heures)).replace(".", ",")} h de main-d'œuvre`);
  return parties.join(", ");
}

// Composants reçus du formulaire d'un kit → lignes ComposantKit à créer, ou
// { erreur }. Pièce : { pieceId, qte } (entier ≥ 1, une pièce d'inventaire
// qui n'est pas un kit) ; main-d'œuvre : { description, qte (heures),
// coutHoraire }. pieces : les fiches des pieceId reçus.
export function validerComposantsKit(composants, pieces, kitId = null) {
  if (!Array.isArray(composants) || composants.length === 0) return { erreur: "Ajoute au moins une pièce ou de la main-d'œuvre au kit." };
  const lignes = [];
  for (const [ordre, c] of composants.entries()) {
    const qte = Number(c.qte);
    if (c.pieceId) {
      const piece = pieces.find((p) => p.id === c.pieceId);
      if (!piece) return { erreur: "Une pièce du kit est introuvable." };
      if (piece.estKit || piece.id === kitId) return { erreur: `« ${piece.nom} » est un kit — un kit ne peut pas en contenir un autre.` };
      if (!Number.isInteger(qte) || qte < 1) return { erreur: `Quantité invalide pour « ${piece.nom} » (nombre entier, au moins 1).` };
      if (lignes.some((l) => l.pieceId === piece.id)) return { erreur: `« ${piece.nom} » est en double dans le kit — additionne plutôt les quantités.` };
      lignes.push({ pieceId: piece.id, qte, ordre });
    } else {
      const coutHoraire = Number(c.coutHoraire) || 0;
      if (!(qte > 0)) return { erreur: "Heures de main-d'œuvre invalides." };
      if (coutHoraire < 0) return { erreur: "Coût horaire invalide." };
      lignes.push({ description: String(c.description || "").trim() || "Main-d'œuvre", qte, coutHoraire, ordre });
    }
  }
  return { lignes };
}
