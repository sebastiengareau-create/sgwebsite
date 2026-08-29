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

  const { module: nomModule, actif } = await request.json();
  if (!nomModule) return NextResponse.json({ erreur: "Module manquant." }, { status: 400 });

  await prisma.parametre.upsert({
    where: { cle: `module_${nomModule}` },
    update: { valeur: actif ? "actif" : "inactif" },
    create: { cle: `module_${nomModule}`, valeur: actif ? "actif" : "inactif" },
  });

  return NextResponse.json({ ok: true });
}
