import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const body = await request.json();
  const data = {};
  if (typeof body.nom === "string" && body.nom.trim()) data.nom = body.nom.trim();
  if (typeof body.actif === "boolean") data.actif = body.actif;
  if (body.compteDepenseNumero) {
    const compte = await prisma.compte.findUnique({ where: { numero: body.compteDepenseNumero } });
    if (!compte) return NextResponse.json({ erreur: "Compte de dépense introuvable." }, { status: 400 });
    data.compteDepenseNumero = body.compteDepenseNumero;
  }

  const categorie = await prisma.categorieDepense.update({ where: { id: params.id }, data });
  return NextResponse.json(categorie);
}
