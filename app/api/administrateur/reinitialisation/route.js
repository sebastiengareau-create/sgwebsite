import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { effacerToutesLesDonnees } from "@/lib/sauvegarde";

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

  const { confirmation, inclureConfiguration } = await request.json();
  const phraseAttendue = inclureConfiguration ? "EFFACER TOUT" : "EFFACER DONNEES";
  if (confirmation !== phraseAttendue) {
    return NextResponse.json({ erreur: "Confirmation manquante ou incorrecte." }, { status: 400 });
  }

  try {
    await effacerToutesLesDonnees({ inclureConfiguration: !!inclureConfiguration });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erreur: "Échec de la réinitialisation : " + e.message }, { status: 500 });
  }
}
