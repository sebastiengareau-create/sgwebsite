import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json();
  const data = {};
  if (typeof body.nom === "string" && body.nom.trim()) data.nom = body.nom.trim();
  if (typeof body.actif === "boolean") data.actif = body.actif;
  if (body.compteRevenuNumero) {
    const compte = await prisma.compte.findUnique({ where: { numero: body.compteRevenuNumero } });
    if (!compte) return NextResponse.json({ erreur: "Compte de revenu introuvable." }, { status: 400 });
    data.compteRevenuNumero = body.compteRevenuNumero;
  }

  const categorie = await prisma.categorieInventaire.update({ where: { id: params.id }, data });
  return NextResponse.json(categorie);
}
