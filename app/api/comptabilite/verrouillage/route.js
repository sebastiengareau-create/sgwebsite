import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";

export async function PATCH(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { date } = await request.json(); // "YYYY-MM-DD" ou null pour déverrouiller

  await prisma.parametre.upsert({
    where: { cle: "comptabilite_verrouille_avant" },
    update: { valeur: date || "" },
    create: { cle: "comptabilite_verrouille_avant", valeur: date || "" },
  });

  return NextResponse.json({ ok: true });
}
