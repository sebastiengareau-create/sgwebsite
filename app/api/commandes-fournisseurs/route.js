import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { creerAvecNumero, prochainNumeroCommandeFournisseur } from "@/lib/numerotation";

// Crée une commande, ou ajoute des pièces au brouillon déjà ouvert chez ce
// fournisseur (ajouterAuBrouillon) — ex. « Commander chez NAPA » depuis la
// fiche d'une pièce. lignes : [{ pieceId, qte, coutUnitaire? }].
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { fournisseurId, lignes = [], ajouterAuBrouillon, note } = await request.json();
  const fournisseur = fournisseurId ? await prisma.fournisseur.findUnique({ where: { id: fournisseurId } }) : null;
  if (!fournisseur) return NextResponse.json({ erreur: "Choisis un fournisseur." }, { status: 400 });

  const lignesValides = lignes.filter((l) => l.pieceId && Math.floor(Number(l.qte)) > 0);
  const [pieces, liens] = await Promise.all([
    prisma.piece.findMany({ where: { id: { in: lignesValides.map((l) => l.pieceId) } } }),
    prisma.pieceFournisseur.findMany({ where: { fournisseurId, pieceId: { in: lignesValides.map((l) => l.pieceId) } } }),
  ]);
  const pieceParId = new Map(pieces.map((p) => [p.id, p]));
  const lienParPiece = new Map(liens.map((l) => [l.pieceId, l]));

  // Prix prévu : celui saisi, sinon le dernier payé chez ce fournisseur,
  // sinon le coût moyen de la pièce.
  const nouvellesLignes = lignesValides.filter((l) => pieceParId.has(l.pieceId)).map((l) => {
    const lien = lienParPiece.get(l.pieceId);
    const cout = l.coutUnitaire !== undefined && l.coutUnitaire !== "" ? Number(l.coutUnitaire) : (lien?.coutant ?? pieceParId.get(l.pieceId).coutant);
    return { pieceId: l.pieceId, qteCommandee: Math.floor(Number(l.qte)), coutUnitaire: cout || 0, numeroFournisseur: lien?.numeroFournisseur || null };
  });

  const brouillon = ajouterAuBrouillon
    ? await prisma.commandeFournisseur.findFirst({ where: { fournisseurId, statut: "BROUILLON" }, orderBy: { creeLe: "desc" }, include: { lignes: true } })
    : null;

  if (brouillon) {
    await prisma.$transaction(async (tx) => {
      for (const l of nouvellesLignes) {
        const existante = brouillon.lignes.find((x) => x.pieceId === l.pieceId);
        if (existante) {
          await tx.ligneCommandeFournisseur.update({ where: { id: existante.id }, data: { qteCommandee: existante.qteCommandee + l.qteCommandee } });
        } else {
          await tx.ligneCommandeFournisseur.create({ data: { ...l, commandeId: brouillon.id } });
        }
      }
    });
    return NextResponse.json({ id: brouillon.id, numero: brouillon.numero, ajouteeAuBrouillon: true });
  }

  const commande = await creerAvecNumero(prochainNumeroCommandeFournisseur, (numero) =>
    prisma.commandeFournisseur.create({
      data: { numero, fournisseurId, note: note || null, creePar: session.nom, lignes: { create: nouvellesLignes } },
    })
  );
  return NextResponse.json({ id: commande.id, numero: commande.numero, ajouteeAuBrouillon: false });
}
