import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { normaliserProvince, normaliserCodePostal } from "@/lib/adresse";

export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const body = await request.json();
  const data = {};
  if (typeof body.nom === "string" && body.nom.trim()) data.nom = body.nom.trim();
  if (body.telephone !== undefined) data.telephone = body.telephone || null;
  if (body.courriel !== undefined) data.courriel = body.courriel || null;
  if (body.adresse !== undefined) data.adresse = body.adresse || null;
  if (body.ville !== undefined) data.ville = body.ville || null;
  if (body.province !== undefined) data.province = normaliserProvince(body.province);
  if (body.codePostal !== undefined) data.codePostal = normaliserCodePostal(body.codePostal);
  if (typeof body.actif === "boolean") data.actif = body.actif;

  const fournisseur = await prisma.fournisseur.update({ where: { id: params.id }, data });
  return NextResponse.json(fournisseur);
}

export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const depenses = await prisma.depense.count({ where: { fournisseurId: params.id } });
  if (depenses > 0) {
    return NextResponse.json(
      { erreur: "Ce fournisseur a des dépenses associées — désactive-le plutôt que de le supprimer, pour ne pas perdre cet historique." },
      { status: 409 }
    );
  }

  const commandes = await prisma.commandeFournisseur.count({ where: { fournisseurId: params.id } });
  if (commandes > 0) {
    return NextResponse.json(
      { erreur: "Ce fournisseur a des commandes — désactive-le plutôt que de le supprimer, pour ne pas perdre cet historique." },
      { status: 409 }
    );
  }

  await prisma.fournisseur.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
