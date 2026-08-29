import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { CLES_PARAMETRE } from "@/lib/config";

export async function PATCH(request) {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json();

  for (const [champ, cle] of Object.entries(CLES_PARAMETRE)) {
    if (body[champ] === undefined) continue;
    await prisma.parametre.upsert({
      where: { cle },
      update: { valeur: String(body[champ] || "") },
      create: { cle, valeur: String(body[champ] || "") },
    });
  }

  return NextResponse.json({ ok: true });
}
