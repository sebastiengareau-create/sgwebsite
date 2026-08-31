import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const rdv = await prisma.rendezVous.findUnique({ where: { id: params.id } });
  if (!rdv) return NextResponse.json({ erreur: "Rendez-vous introuvable." }, { status: 404 });
  if (rdv.bonId) return NextResponse.json({ erreur: "Déjà transformé en bon." }, { status: 409 });

  let clientId = rdv.clientId;
  if (!clientId) {
    const client = await prisma.client.create({
      data: { nom: rdv.clientNom, telephone: rdv.clientTelephone || null },
    });
    clientId = client.id;
  }

  const dernierBon = await prisma.bonTravail.findFirst({ orderBy: { numero: "desc" } });
  let prochainNum = 1;
  if (dernierBon) {
    const partieNum = parseInt(dernierBon.numero.split("-")[1], 10);
    if (!isNaN(partieNum)) prochainNum = partieNum + 1;
  }
  const numero = `2026-${String(1000 + prochainNum).slice(1)}`;

  const bon = await prisma.bonTravail.create({
    data: {
      numero,
      clientId,
      problemes: { create: [{ description: rdv.motif }] },
    },
  });

  await prisma.rendezVous.update({ where: { id: rdv.id }, data: { statut: "COMPLETE", bonId: bon.id } });

  return NextResponse.json({ bonId: bon.id, bonNumero: bon.numero });
}
