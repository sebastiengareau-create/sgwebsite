import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";

// Marque lues des notifications de l'employé connecté : { ids: [...] }, ou
// toutes avec { toutes: true }
export async function POST(request) {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const { ids, toutes } = await request.json().catch(() => ({}));
  if (!toutes && !Array.isArray(ids)) return NextResponse.json({ erreur: "Rien à marquer." }, { status: 400 });
  await prisma.notification.updateMany({
    where: { employeId: session.id, lue: false, ...(!toutes && { id: { in: ids.map(String) } }) },
    data: { lue: true },
  });
  return NextResponse.json({ ok: true });
}
