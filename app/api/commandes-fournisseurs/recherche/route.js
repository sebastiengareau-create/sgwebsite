import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { ajouterACommande, pieceDepuisRecherche } from "@/lib/brouillonsCommande";

// Pièce trouvée chez un fournisseur avec « 🔎 Rechercher chez nos
// fournisseurs » d'une commande de pièces en brouillon : même logique que
// « 🛒 Commander » d'un bon (fiche d'inventaire trouvée par le numéro, sinon
// créée), ajoutée à cette commande.
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

  const commande = corps.commandeId
    ? await prisma.commandeFournisseur.findUnique({ where: { id: corps.commandeId }, include: { lignes: { select: { qteRecue: true } }, fournisseur: true } })
    : null;
  if (!commande) return NextResponse.json({ erreur: "Commande introuvable." }, { status: 404 });
  if (commande.statut !== "BROUILLON" || commande.lignes.some((l) => l.qteRecue > 0)) {
    return NextResponse.json({ erreur: "La recherche de pièces ajoute seulement à une commande en brouillon." }, { status: 409 });
  }
  const fournisseur = commande.fournisseur;

  const trouvee = await pieceDepuisRecherche({ fournisseurId: fournisseur.id, numero, nom: description, cout, prixVente: corps.prixVente });
  if (trouvee.erreur) return NextResponse.json({ erreur: trouvee.erreur }, { status: trouvee.status });

  const resultat = await ajouterACommande({
    fournisseurId: fournisseur.id,
    lignes: [{ pieceId: trouvee.piece.id, qte, coutUnitaire: cout ?? undefined, numeroFournisseur: numero }],
    commandeId: commande.id,
    creePar: session.nom,
  });
  const ligne = await prisma.ligneCommandeFournisseur.findFirst({
    where: { commandeId: resultat.id, pieceId: trouvee.piece.id },
    select: { pieceId: true, numeroFournisseur: true, qteCommandee: true, coutUnitaire: true },
  });
  const piece = await prisma.piece.findUnique({
    where: { id: trouvee.piece.id },
    include: { fournisseurs: { include: { fournisseur: { select: { nom: true } } } } },
  });
  return NextResponse.json({ ...resultat, pieceCreee: trouvee.creee, piece, ligne });
}
