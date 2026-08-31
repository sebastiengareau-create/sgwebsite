import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom, telephone, courriel, adresse, ville, codePostal } = await request.json();
  if (!nom) return NextResponse.json({ erreur: "Le nom est requis." }, { status: 400 });

  const doublon = await prisma.client.findFirst({
    where: { nom: { equals: nom.trim(), mode: "insensitive" }, NOT: { id: params.id } },
  });
  if (doublon) {
    return NextResponse.json({ erreur: `Un autre client nommé "${doublon.nom}" existe déjà.` }, { status: 409 });
  }

  const client = await prisma.client.update({
    where: { id: params.id },
    data: {
      nom,
      telephone: telephone || null,
      courriel: courriel || null,
      adresse: adresse || null,
      ville: ville || null,
      codePostal: codePostal || null,
    },
  });
  return NextResponse.json(client);
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const bons = await prisma.bonTravail.count({ where: { clientId: params.id } });
  if (bons > 0) {
    return NextResponse.json(
      { erreur: "Ce client a des bons de travail associés — il ne peut pas être supprimé pour préserver l'historique." },
      { status: 409 }
    );
  }

  await prisma.client.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
