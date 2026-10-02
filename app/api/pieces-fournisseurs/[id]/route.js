import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { messageDoublon } from "@/lib/piecesFournisseurs";

export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { numeroFournisseur, coutant } = await request.json();
  const lien = await prisma.pieceFournisseur.findUnique({ where: { id: params.id } });
  if (!lien) return NextResponse.json({ erreur: "Lien introuvable." }, { status: 404 });

  try {
    const maj = await prisma.pieceFournisseur.update({
      where: { id: params.id },
      data: {
        ...(numeroFournisseur !== undefined && { numeroFournisseur: numeroFournisseur?.trim() || null }),
        ...(coutant !== undefined && { coutant: coutant === "" || coutant == null ? null : Number(coutant) }),
      },
      include: { fournisseur: true },
    });
    return NextResponse.json(maj);
  } catch (e) {
    if (e.code === "P2002") return NextResponse.json({ erreur: await messageDoublon(e, lien.fournisseurId, numeroFournisseur) }, { status: 409 });
    throw e;
  }
}

export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  await prisma.pieceFournisseur.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
