import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";

export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const employeId = session.id;
  const problemeId = params.problemeId;

  try {
    const utilisateur = await prisma.user.findUnique({ where: { id: employeId } });
    if (!utilisateur) {
      return NextResponse.json(
        { erreur: "Ta session est expirée (probablement après une réinitialisation de la base). Déconnecte-toi et reconnecte-toi." },
        { status: 401 }
      );
    }

    const probleme = await prisma.probleme.findUnique({ where: { id: problemeId } });
    if (!probleme) return NextResponse.json({ erreur: "Tâche introuvable." }, { status: 404 });

    const active = await prisma.entreeTemps.findFirst({ where: { employeId, problemeId, fin: null } });

    if (active) {
      await prisma.entreeTemps.update({ where: { id: active.id }, data: { fin: new Date() } });
      return NextResponse.json({ statut: "arrete" });
    }

    await prisma.entreeTemps.create({ data: { employeId, problemeId, debut: new Date() } });

    // Le bon passe automatiquement "En cours" dès qu'un poinçon démarre,
    // s'il était encore "En attente"
    const bon = await prisma.bonTravail.findUnique({ where: { id: probleme.bonId } });
    if (bon && bon.statut === "EN_ATTENTE") {
      await prisma.bonTravail.update({ where: { id: bon.id }, data: { statut: "EN_COURS" } });
    }

    return NextResponse.json({ statut: "demarre" });
  } catch (e) {
    return NextResponse.json({ erreur: "Erreur serveur : " + e.message }, { status: 500 });
  }
}
