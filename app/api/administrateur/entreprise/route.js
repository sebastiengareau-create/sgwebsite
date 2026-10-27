import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { CLES_PARAMETRE } from "@/lib/config";
import { formaterTelephone } from "@/lib/telephone";

export async function PATCH(request) {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json();

  for (const [champ, cle] of Object.entries(CLES_PARAMETRE)) {
    if (body[champ] === undefined) continue;
    const valeur = champ === "telephone" ? formaterTelephone(String(body[champ] || "")) : String(body[champ] || "");
    await prisma.parametre.upsert({
      where: { cle },
      update: { valeur },
      create: { cle, valeur },
    });
  }

  return NextResponse.json({ ok: true });
}
