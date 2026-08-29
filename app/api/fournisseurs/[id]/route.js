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
  if (body.telephone !== undefined) data.telephone = body.telephone || null;
  if (body.courriel !== undefined) data.courriel = body.courriel || null;
  if (body.adresse !== undefined) data.adresse = body.adresse || null;
  if (typeof body.actif === "boolean") data.actif = body.actif;

  const fournisseur = await prisma.fournisseur.update({ where: { id: params.id }, data });
  return NextResponse.json(fournisseur);
}
