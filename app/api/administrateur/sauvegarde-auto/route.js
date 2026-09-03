import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { CLE_COURRIEL } from "@/lib/planificateurSauvegarde";

async function estAutorise(session) {
  if (!session) return false;
  if (session.role === "DEVELOPPEUR") return true;
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
  return utilisateur?.estSuperAdmin || false;
}

export async function PATCH(request) {
  const session = await obtenirSession();
  if (!(await estAutorise(session))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { courriel } = await request.json();
  const valeur = (courriel || "").trim();

  await prisma.parametre.upsert({
    where: { cle: CLE_COURRIEL },
    update: { valeur },
    create: { cle: CLE_COURRIEL, valeur },
  });

  return NextResponse.json({ ok: true, courriel: valeur });
}
