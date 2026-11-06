import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";
import { COMPTE_PIECES_SOUMISSION, lirePieceHorsInventaire } from "@/lib/piecesSoumission";
import { annulerRetourHorsInventaire } from "@/lib/retours";

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
    include: { _count: { select: { pieces: true, retours: true } }, bon: { select: { numero: true, client: { select: { nom: true } } } } },
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
  // Retour (lib/retours.js) : suit la vente d'origine — le retirer et le refaire
  if (ligne.retourDeProblemeId) return NextResponse.json({ erreur: "Un retour ne se modifie pas — retire-le et refais-le." }, { status: 409 });
  const { data, erreur } = lirePieceHorsInventaire(await request.json());
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });
  if (ligne._count.retours > 0) {
    const retourne = -(await prisma.probleme.aggregate({ where: { retourDeProblemeId: ligne.id }, _sum: { factureQte: true } }))._sum.factureQte || 0;
    if (data.factureQte < retourne) return NextResponse.json({ erreur: `${retourne} de ces pièces ont déjà été retournées sur un autre bon.` }, { status: 409 });
  }
  return NextResponse.json(await prisma.probleme.update({ where: { id: ligne.id }, data }));
}

export async function DELETE(request, props) {
  const params = await props.params;
  const { ligne, reponse } = await trouver(params);
  if (reponse) return reponse;
  if (ligne._count.retours > 0) {
    return NextResponse.json({ erreur: "Cette pièce a été retournée sur un autre bon — retire d'abord ce retour." }, { status: 409 });
  }
  const session = await obtenirSession();
  await prisma.$transaction(async (tx) => {
    // Retour : la pièce ressort de la fiche d'inventaire où elle avait été mise
    if (ligne.retourDeProblemeId) {
      await annulerRetourHorsInventaire(tx, ligne, { note: `Retour retiré — Bon #${ligne.bon.numero} — ${ligne.bon.client.nom}`, creePar: session.nom });
    }
    await tx.probleme.delete({ where: { id: ligne.id } });
  });
  return NextResponse.json({ ok: true });
}
