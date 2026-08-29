import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { dateHeureLocaleVersUTC } from "@/lib/temps";

export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { employeId, debut, fin } = await request.json();
  if (!employeId || !debut || !fin) {
    return NextResponse.json({ erreur: "Employé, début et fin requis." }, { status: 400 });
  }

  const debutUTC = dateHeureLocaleVersUTC(debut);
  const finUTC = dateHeureLocaleVersUTC(fin);
  if (finUTC <= debutUTC) {
    return NextResponse.json({ erreur: "L'heure de fin doit être après le début." }, { status: 400 });
  }

  const probleme = await prisma.probleme.findUnique({ where: { id: params.problemeId } });
  if (!probleme) return NextResponse.json({ erreur: "Tâche introuvable." }, { status: 404 });

  const entree = await prisma.entreeTemps.create({
    data: { employeId, problemeId: params.problemeId, debut: debutUTC, fin: finUTC },
  });

  return NextResponse.json(entree);
}
