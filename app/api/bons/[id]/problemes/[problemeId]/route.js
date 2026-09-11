import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { COMPTES_REVENU_RESERVES } from "@/lib/comptabilite";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  const { description, categorieRevenu, factureDescription, facturePrixUnitaire, factureQte } = await request.json();

  const data = {};
  if (description !== undefined) {
    if (!description || !description.trim()) {
      return NextResponse.json({ erreur: "La description ne peut pas être vide." }, { status: 400 });
    }
    data.description = description.trim();
  }
  if (categorieRevenu !== undefined) {
    if (categorieRevenu !== "MAIN_OEUVRE") {
      if (COMPTES_REVENU_RESERVES.includes(categorieRevenu)) {
        return NextResponse.json({ erreur: "Poste de revenu invalide." }, { status: 400 });
      }
      const compte = await prisma.compte.findUnique({ where: { numero: categorieRevenu } });
      if (!compte || compte.type !== "REVENU" || !compte.actif) {
        return NextResponse.json({ erreur: "Poste de revenu invalide." }, { status: 400 });
      }
    }
    data.categorieRevenu = categorieRevenu;
  }
  if (factureDescription !== undefined) data.factureDescription = factureDescription || null;
  if (facturePrixUnitaire !== undefined) data.facturePrixUnitaire = Number(facturePrixUnitaire) || 0;
  if (factureQte !== undefined) data.factureQte = Number(factureQte) || 1;

  const probleme = await prisma.probleme.update({ where: { id: params.problemeId }, data });
  return NextResponse.json(probleme);
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  await prisma.probleme.delete({ where: { id: params.problemeId } });
  return NextResponse.json({ ok: true });
}
