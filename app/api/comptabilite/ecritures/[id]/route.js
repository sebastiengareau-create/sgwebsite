import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { verifierNonVerrouille } from "@/lib/comptabilite";

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const ecriture = await prisma.ecritureComptable.findUnique({ where: { id: params.id } });
  if (!ecriture) return NextResponse.json({ erreur: "Écriture introuvable." }, { status: 404 });

  try {
    await verifierNonVerrouille(ecriture.date);
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("VERROUILLE:", "") }, { status: 423 });
  }

  await prisma.ecritureComptable.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
