import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function GET() {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const clients = await prisma.client.findMany({ orderBy: { nom: "asc" } });
  return NextResponse.json(clients);
}

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom, telephone, courriel, adresse, ville, codePostal } = await request.json();
  if (!nom) return NextResponse.json({ erreur: "Le nom est requis." }, { status: 400 });

  const doublon = await prisma.client.findFirst({
    where: { nom: { equals: nom.trim(), mode: "insensitive" } },
  });
  if (doublon) {
    return NextResponse.json({ erreur: `Un client nommé "${doublon.nom}" existe déjà.` }, { status: 409 });
  }

  const client = await prisma.client.create({
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
