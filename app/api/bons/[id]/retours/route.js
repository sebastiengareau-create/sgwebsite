import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";
import { piecesRetournables, ajouterRetour } from "@/lib/retours";

// Pièces vendues au client du bon, encore retournables (lib/retours.js)
export async function GET(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  return NextResponse.json({ pieces: await piecesRetournables(params.id) });
}

// Ajoute un retour sur une tâche du bon
// — corps : { problemeId, ligneOrigineId, qte, defectueuse }
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }
  const { problemeId, ligneOrigineId, qte, defectueuse = false } = await request.json();
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
