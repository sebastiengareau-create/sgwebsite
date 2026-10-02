import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { messageDoublon } from "@/lib/piecesFournisseurs";

// Lie une pièce à un fournisseur, avec le numéro de la pièce dans son
// catalogue et son prix — une seule fiche d'inventaire pour tous les numéros.
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { pieceId, fournisseurId, numeroFournisseur, coutant } = await request.json();
  if (!pieceId || !fournisseurId) return NextResponse.json({ erreur: "Pièce et fournisseur requis." }, { status: 400 });

  try {
    const lien = await prisma.pieceFournisseur.create({
      data: {
        pieceId,
        fournisseurId,
        numeroFournisseur: numeroFournisseur?.trim() || null,
        coutant: coutant === "" || coutant == null ? null : Number(coutant),
      },
      include: { fournisseur: true },
    });
    return NextResponse.json(lien);
  } catch (e) {
    if (e.code === "P2002") return NextResponse.json({ erreur: await messageDoublon(e, fournisseurId, numeroFournisseur) }, { status: 409 });
    throw e;
  }
}
