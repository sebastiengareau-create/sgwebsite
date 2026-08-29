import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";

async function estVraimentSuperAdmin(session) {
  if (!session?.id) return false;
  if (session.role === "DEVELOPPEUR") return true;
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
  return utilisateur?.estSuperAdmin || false;
}

export async function PATCH(request) {
  const session = await obtenirSession();
  if (!(await estVraimentSuperAdmin(session))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { verrouille } = await request.json();

  await prisma.parametre.upsert({
    where: { cle: "compte_verrouille" },
    update: { valeur: verrouille ? "actif" : "inactif" },
    create: { cle: "compte_verrouille", valeur: verrouille ? "actif" : "inactif" },
  });

  return NextResponse.json({ ok: true });
}
