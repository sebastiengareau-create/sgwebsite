import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";

export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const employeId = session.id;
  const tacheInterneId = params.id;

  try {
    const utilisateur = await prisma.user.findUnique({ where: { id: employeId } });
    if (!utilisateur) {
      return NextResponse.json(
        { erreur: "Ta session est expirée (probablement après une réinitialisation de la base). Déconnecte-toi et reconnecte-toi." },
        { status: 401 }
      );
    }

    const tache = await prisma.tacheInterne.findUnique({ where: { id: tacheInterneId } });
    if (!tache) return NextResponse.json({ erreur: "Tâche interne introuvable." }, { status: 404 });

    const active = await prisma.entreeTempsInterne.findFirst({ where: { employeId, tacheInterneId, fin: null } });

    if (active) {
      await prisma.entreeTempsInterne.update({ where: { id: active.id }, data: { fin: new Date() } });
      return NextResponse.json({ statut: "arrete" });
    }

    await prisma.entreeTempsInterne.create({ data: { employeId, tacheInterneId, debut: new Date() } });
    return NextResponse.json({ statut: "demarre" });
  } catch (e) {
    return NextResponse.json({ erreur: "Erreur serveur : " + e.message }, { status: 500 });
  }
}
