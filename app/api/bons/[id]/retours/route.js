import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";
import { piecesRetournables, ajouterRetour, ajouterRetourHorsInventaire } from "@/lib/retours";

// Pièces vendues au client du bon, encore retournables (lib/retours.js)
export async function GET(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  return NextResponse.json({ pieces: await piecesRetournables(params.id) });
}

// Ajoute un retour sur le bon
// — pièce d'inventaire : { problemeId, ligneOrigineId, qte, defectueuse }
// — pièce hors inventaire : { type: "HORS_INVENTAIRE", ligneOrigineId, qte,
//   defectueuse, fiche: { pieceId } | { nouvelle: { nom, numero } } }
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }
  const { type, problemeId, ligneOrigineId, qte, defectueuse = false, fiche = {} } = await request.json();
  if (type === "HORS_INVENTAIRE") {
    const bon = await prisma.bonTravail.findUnique({ where: { id: params.id }, include: { client: true } });
    if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });
    try {
      const ligne = await prisma.$transaction((tx) => ajouterRetourHorsInventaire(tx, {
        bon, ligneOrigineId, quantite: qte, defectueuse: defectueuse === true, fiche: fiche || {}, creePar: session.nom,
      }));
      return NextResponse.json(ligne);
    } catch (e) {
      if (e.name?.startsWith("Prisma")) throw e;
      return NextResponse.json({ erreur: e.message }, { status: 400 });
    }
  }
  const probleme = problemeId
    ? await prisma.probleme.findUnique({ where: { id: problemeId }, include: { bon: { include: { client: true } } } })
    : null;
  if (!probleme || probleme.bonId !== params.id) {
    return NextResponse.json({ erreur: "Ligne de problème introuvable." }, { status: 404 });
  }
  try {
    const ligne = await prisma.$transaction((tx) => ajouterRetour(tx, {
      probleme, ligneOrigineId, quantite: qte, defectueuse: defectueuse === true, creePar: session.nom,
    }));
    return NextResponse.json(ligne);
  } catch (e) {
    if (e.name?.startsWith("Prisma")) throw e;
    return NextResponse.json({ erreur: e.message }, { status: 400 });
  }
}
