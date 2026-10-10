import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { ajouterACommande, pieceDepuisRecherche } from "@/lib/brouillonsCommande";

// Pièce trouvée chez un fournisseur avec « 🔎 Rechercher chez nos
// fournisseurs » des commandes de pièces : même logique que « 🛒 Commander »
// d'un bon (fiche d'inventaire trouvée par le numéro, sinon créée), sans bon.
// commandeId : dans cette commande (fiche d'une commande) ; sinon dans le
// brouillon ouvert chez le fournisseur, ou une nouvelle commande.
// → { id, numero, ajouteeAuBrouillon, pieceCreee, piece, ligne }
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const corps = await request.json().catch(() => ({}));
  const description = String(corps.description || "").trim().slice(0, 150);
  const numero = String(corps.numero || "").trim().slice(0, 60);
  const qte = Number(corps.qte);
  const cout = corps.coutUnitaire === "" || corps.coutUnitaire == null ? null : Number(String(corps.coutUnitaire).replace(",", "."));
  if (!description) return NextResponse.json({ erreur: "Indique la description de la pièce." }, { status: 400 });
  if (!numero) return NextResponse.json({ erreur: "Indique le numéro de la pièce chez le fournisseur." }, { status: 400 });
  if (!Number.isInteger(qte) || qte < 1 || qte > 999) return NextResponse.json({ erreur: "Quantité invalide." }, { status: 400 });
  if (cout !== null && !(cout >= 0)) return NextResponse.json({ erreur: "Coût unitaire invalide." }, { status: 400 });

  let fournisseurId = corps.fournisseurId;
  if (corps.commandeId) {
    const commande = await prisma.commandeFournisseur.findUnique({ where: { id: corps.commandeId }, include: { lignes: { select: { qteRecue: true } } } });
    if (!commande) return NextResponse.json({ erreur: "Commande introuvable." }, { status: 404 });
    if (!["BROUILLON", "ENVOYEE"].includes(commande.statut) || commande.lignes.some((l) => l.qteRecue > 0)) {
      return NextResponse.json({ erreur: "Cette commande a déjà été reçue (en tout ou en partie) — ses lignes ne se modifient plus." }, { status: 409 });
    }
    fournisseurId = commande.fournisseurId;
  }
  const fournisseur = fournisseurId ? await prisma.fournisseur.findUnique({ where: { id: fournisseurId } }) : null;
  if (!fournisseur || (!corps.commandeId && !fournisseur.actif)) return NextResponse.json({ erreur: "Choisis un fournisseur." }, { status: 400 });

  const trouvee = await pieceDepuisRecherche({ fournisseurId: fournisseur.id, numero, nom: description, cout, prixVente: corps.prixVente });
  if (trouvee.erreur) return NextResponse.json({ erreur: trouvee.erreur }, { status: trouvee.status });

  const commande = await ajouterACommande({
    fournisseurId: fournisseur.id,
    lignes: [{ pieceId: trouvee.piece.id, qte, coutUnitaire: cout ?? undefined, numeroFournisseur: numero }],
    ajouterAuBrouillon: true,
    commandeId: corps.commandeId || undefined,
    creePar: session.nom,
  });
  const ligne = await prisma.ligneCommandeFournisseur.findFirst({
    where: { commandeId: commande.id, pieceId: trouvee.piece.id },
    select: { pieceId: true, numeroFournisseur: true, qteCommandee: true, coutUnitaire: true },
  });
  const piece = await prisma.piece.findUnique({
    where: { id: trouvee.piece.id },
    include: { fournisseurs: { include: { fournisseur: { select: { nom: true } } } } },
  });
  return NextResponse.json({ ...commande, pieceCreee: trouvee.creee, piece, ligne });
}
