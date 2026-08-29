import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { nom, telephone, courriel, adresse } = await request.json();
  if (!nom || !nom.trim()) return NextResponse.json({ erreur: "Le nom est requis." }, { status: 400 });

  const fournisseur = await prisma.fournisseur.create({
    data: { nom: nom.trim(), telephone: telephone || null, courriel: courriel || null, adresse: adresse || null },
  });
  return NextResponse.json(fournisseur);
}
