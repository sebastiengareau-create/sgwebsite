import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";

const TYPES_VALIDES = ["ACTIF", "PASSIF", "CAPITAUX_PROPRES", "REVENU", "DEPENSE"];

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { numero, nom, type } = await request.json();
  if (!numero || !nom || !TYPES_VALIDES.includes(type)) {
    return NextResponse.json({ erreur: "Numéro, nom et type valide requis." }, { status: 400 });
  }

  const existant = await prisma.compte.findUnique({ where: { numero: numero.trim() } });
  if (existant) {
    return NextResponse.json({ erreur: `Le numéro ${numero} est déjà utilisé par "${existant.nom}".` }, { status: 409 });
  }

  const compte = await prisma.compte.create({ data: { numero: numero.trim(), nom: nom.trim(), type } });
  return NextResponse.json(compte);
}
