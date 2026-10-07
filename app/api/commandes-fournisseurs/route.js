import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { ajouterACommande } from "@/lib/brouillonsCommande";

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

  const resultat = await ajouterACommande({ fournisseurId, lignes, ajouterAuBrouillon, note, creePar: session.nom });
  return NextResponse.json(resultat);
}
