import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { importerDonnees } from "@/lib/sauvegarde";

async function estAutorise(session) {
  if (!session) return false;
  if (session.role === "DEVELOPPEUR") return true;
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
  return utilisateur?.estSuperAdmin || false;
}

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await estAutorise(session))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { donnees, confirmation } = await request.json();
  if (confirmation !== "RESTAURER") {
    return NextResponse.json({ erreur: "Confirmation manquante ou incorrecte." }, { status: 400 });
  }

  try {
    await importerDonnees(donnees);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erreur: "Échec de la restauration : " + e.message }, { status: 500 });
  }
}
