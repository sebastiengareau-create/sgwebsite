import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";
import { COMPTE_PIECES_SOUMISSION, lirePieceHorsInventaire } from "@/lib/piecesSoumission";

// Modifier ou retirer une pièce hors inventaire du bon (avant la facture)
async function trouver(params) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return { reponse: NextResponse.json({ erreur: "Accès refusé." }, { status: 403 }) };
  }
  if (await bonEstVerrouille(params.id)) {
    return { reponse: NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 }) };
  }
  const ligne = await prisma.probleme.findFirst({
    where: { id: params.ligneId, bonId: params.id, categorieRevenu: COMPTE_PIECES_SOUMISSION },
    include: { _count: { select: { pieces: true } } },
  });
  // Une ligne qui porte une pièce d'inventaire (soumission facturée) ne se
  // modifie pas ici
  if (!ligne || ligne._count.pieces > 0) {
    return { reponse: NextResponse.json({ erreur: "Pièce introuvable sur ce bon." }, { status: 404 }) };
  }
  return { ligne };
}

export async function PATCH(request, props) {
  const params = await props.params;
  const { ligne, reponse } = await trouver(params);
  if (reponse) return reponse;
  const { data, erreur } = lirePieceHorsInventaire(await request.json());
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });
  return NextResponse.json(await prisma.probleme.update({ where: { id: ligne.id }, data }));
}

export async function DELETE(request, props) {
  const params = await props.params;
  const { ligne, reponse } = await trouver(params);
  if (reponse) return reponse;
  await prisma.probleme.delete({ where: { id: ligne.id } });
  return NextResponse.json({ ok: true });
}
