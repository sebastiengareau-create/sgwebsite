import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { quartsActif, pointer } from "@/lib/quarts";

// Pointage de quart par l'employé lui-même : arrivée, dîner, pause, retour
// (fin du dîner ou de la pause), départ — voir lib/quarts.js.
export async function POST(request) {
  const session = await obtenirSession();
  if (!session?.id) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });
  if (!(await quartsActif())) return NextResponse.json({ erreur: "Le pointage de quart n'est pas activé." }, { status: 403 });
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true } });
  if (!utilisateur) return NextResponse.json({ erreur: "Ta session est expirée. Déconnecte-toi et reconnecte-toi." }, { status: 401 });

  const { action } = await request.json().catch(() => ({}));
  const resultat = await pointer(session.id, action);
  if (resultat.erreur) return NextResponse.json(resultat, { status: 409 });
  return NextResponse.json(resultat);
}
