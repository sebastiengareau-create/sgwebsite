import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

// Retire une retenue de la fiche d'un employé. Les paies déjà calculées
// gardent leur propre détail (Paie.retenuesDetail) : rien n'y change.
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const retenue = await prisma.retenueEmploye.findUnique({ where: { id: params.retenueId } });
  if (!retenue || retenue.employeId !== params.id) return NextResponse.json({ erreur: "Retenue introuvable." }, { status: 404 });

  await prisma.retenueEmploye.delete({ where: { id: retenue.id } });
  return NextResponse.json({ ok: true });
}
